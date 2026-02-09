import "./style.css";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LidarControl } from "maplibre-gl-lidar";
import "maplibre-gl-lidar/style.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";

// 1. DEFINICIÓN DE TIPOS (Asegúrate de que esto esté aquí arriba)
type Dataset = { id: string; name: string; url: string };

type VectorLayerCfg = {
  id: string;
  name: string;
  path: string;
  type: "fill" | "line" | "circle" | "points"; // Añadimos "points" aquí
  visible?: boolean;
};

// 2. FUNCIONES DE CARGA
async function loadDatasets(): Promise<Dataset[]> {
  const res = await fetch("/datasets.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar /datasets.json");
  const json = await res.json();
  return (json.datasets ?? []) as Dataset[];
}

async function loadVectorLayers(): Promise<VectorLayerCfg[]> {
  const res = await fetch("/layers_z.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar /layers_z.json");
  const json = await res.json();
  return (json.layers ?? []) as VectorLayerCfg[];
}

// 3. FUNCIÓN PARA AÑADIR CAPAS (Ahora reconoce el tipo VectorLayerCfg)
function addGeoJsonLayer(map: maplibregl.Map, cfg: VectorLayerCfg) {
  const sourceId = `src_${cfg.id}`;
  const vis = cfg.visible === false ? "none" : "visible";

  if (map.getSource(sourceId)) return;

  // 1. Añadimos la fuente (el archivo .geojson de Cloudflare)
  map.addSource(sourceId, {
    type: "geojson",
    data: cfg.path, // URL de tu bucket/servidor
  });

  // 2. Capa para POLÍGONOS
  map.addLayer({
    id: `${sourceId}_fill`,
    type: "fill",
    source: sourceId,
    filter: ["==", "$type", "Polygon"], // Solo polígonos
    layout: { visibility: vis },
    paint: {
      "fill-color": "#00fbff",
      "fill-opacity": 0.4,
      "fill-outline-color": "#ffffff"
    },
  });

  // 3. Capa para LÍNEAS
  map.addLayer({
    id: `${sourceId}_line`,
    type: "line",
    source: sourceId,
    filter: ["==", "$type", "LineString"], // Solo líneas
    layout: { visibility: vis },
    paint: {
      "line-color": "#ffff00",
      "line-width": 2
    },
  });

  // 4. Capa para PUNTOS (Representados como círculos simples)
  map.addLayer({
    id: `${sourceId}_circle`,
    type: "circle",
    source: sourceId,
    filter: ["==", "$type", "Point"], // Solo puntos
    layout: { visibility: vis },
    paint: {
      "circle-radius": 5,
      "circle-color": "#ff00ff",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff"
    },
  });

  // TRUCO FINAL: Traer todo al frente después de un segundo
  setTimeout(() => {
    [`${sourceId}_fill`, `${sourceId}_line`, `${sourceId}_circle`].forEach(id => {
      if (map.getLayer(id)) map.moveLayer(id);
    });
  }, 1000);
}

// 4. INICIALIZACIÓN DEL MAPA
const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: [-3.7038, 40.4168],
  zoom: 12,
  pitch: 60,
  maxPitch: 85,
});

// 5. EVENTO LOAD
map.on("load", async () => {
  // Inicializar Control LiDAR
  const lidarControl = new LidarControl({
    title: "LiDAR Viewer",
    collapsed: true,
    pointSize: 2,
    colorScheme: "rgb",
    pickable: true,
  });
  map.addControl(lidarControl, "top-right");

  const deckOverlay = new MapboxOverlay({
    interleaved: true,
    layers: [],
  });
  map.addControl(deckOverlay as any);

  // Cargar Capas Vectoriales
  try {
    const layers = await loadVectorLayers();
    for (const cfg of layers) {
      addGeoJsonLayer(map, cfg);
    }
  } catch (e) {
    console.error("Error vectores:", e);
  }

  // Cargar LiDAR
  try {
    const datasets = await loadDatasets();
    for (const ds of datasets) {
      lidarControl.loadPointCloud(ds.url);
    }
    if (datasets.length > 0) lidarControl.flyToPointCloud();
  } catch (e) {
    console.error("Error LiDAR:", e);
  }
});