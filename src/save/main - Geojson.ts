import "./style.css";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PolygonLayer } from "@deck.gl/layers";

async function fetchGeoJSON(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar: ${url} (${res.status})`);
  return res.json();
}

const POLIGONOS_URL = "/vector_z/Lagunas_permanentes_z.geojson";
const Z_FIELD = "z";
const Z_OFFSET = 0.5;

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: [-3.7038, 40.4168],
  zoom: 12,
  pitch: 60,
  maxPitch: 85,
});

map.on("load", async () => {
  // Inicializamos el overlay de Deck.gl
  const deckOverlay = new MapboxOverlay({ 
    interleaved: true, 
    layers: [] 
  });
  map.addControl(deckOverlay as any);

  const polysGeo = await fetchGeoJSON(POLIGONOS_URL);
  const feats = polysGeo.features ?? [];

  // --- PROCESAMIENTO DE GEOMETRÍA ---
  // Transformamos las coordenadas para incluir Z y manejamos MultiPolygons
  const processedData = feats.flatMap((f: any) => {
    const zValue = Number(f.properties?.[Z_FIELD] ?? 0) + Z_OFFSET;
    const type = f.geometry.type;
    const coords = f.geometry.coordinates;

    if (type === "Polygon") {
      return [{
        ...f,
        geometry: {
          ...f.geometry,
          // Inyectamos Z en cada punto: [lng, lat] -> [lng, lat, z]
          coordinates: coords.map((ring: any[]) => 
            ring.map(coord => [coord[0], coord[1], zValue])
          )
        }
      }];
    } 
    
    if (type === "MultiPolygon") {
      // Deck.gl maneja mejor los MultiPolygons si los separamos o 
      // aseguramos la estructura de arrays anidados. 
      // Aquí los devolvemos como polígonos individuales para evitar errores de teselación.
      return coords.map((polygonCoords: any[][]) => ({
        ...f,
        geometry: {
          type: "Polygon",
          coordinates: polygonCoords.map((ring: any[]) => 
            ring.map(coord => [coord[0], coord[1], zValue])
          )
        }
      }));
    }
    return [];
  });

  // --- CAPA DE DECK.GL ---
  const layer = new PolygonLayer({
    id: "polys-floating",
    data: processedData,
    getPolygon: (f: any) => f.geometry.coordinates,
    
    // Propiedades visuales
    filled: true,
    stroked: true,
    getFillColor: [0, 255, 255, 100], // Cyan con transparencia
    getLineColor: [0, 255, 255, 255],
    getLineWidth: 2,
    lineWidthMinPixels: 2,

    // Configuración 3D Clave:
    extruded: false,       // <--- IMPORTANTE: Evita que se conviertan en prismas
    _flatShading: true,    // Ayuda a la renderización plana
    
    // Parámetros de profundidad
    parameters: {
      depthTest: true,     // <--- Permite que se oculte tras la nube de puntos si está "debajo"
      depthMask: true,
      blendFunc: [770, 771] // Manejo de transparencia (SRC_ALPHA, ONE_MINUS_SRC_ALPHA)
    },
    pickable: true,
  });

  deckOverlay.setProps({ layers: [layer] });

  // Animación opcional para ver el efecto 3D
  map.easeTo({ zoom: 15, pitch: 75, duration: 2000 });
});