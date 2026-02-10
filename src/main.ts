import "./style.css";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LidarControl } from "maplibre-gl-lidar";
import "maplibre-gl-lidar/style.css";

async function loadDatasets() {
  const res = await fetch("/datasets.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar /datasets.json");
  const json = await res.json();
  return json.datasets || [];
}

const TARGET_CENTER: [number, number] = [-3.59222, 40.42186]; // [lng, lat]
const TARGET_ZOOM = 14;
const TARGET_PITCH = 60;

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: TARGET_CENTER,
  zoom: TARGET_ZOOM,
  pitch: TARGET_PITCH,
  bearing: 0,
  maxPitch: 85,
  antialias: true
});

// --- HUD DE COORDENADAS ---
const hud = document.createElement("div");
hud.id = "coordinates-hud";
hud.style.cssText = `
  position: absolute; bottom: 50px; left: 20px; 
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; background: rgba(15, 23, 42, 0.8); 
  backdrop-filter: blur(8px); color: #f8fafc; 
  font-family: system-ui, sans-serif; font-size: 13px; 
  border-radius: 50px; z-index: 10; border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
`;
hud.innerHTML = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
  <span id="coords-text">0.00000, 0.00000</span>
`;
document.body.appendChild(hud);

map.on("mousemove", (e) => {
  const text = document.getElementById("coords-text");
  if (text) text.textContent = `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`;
});

function clampCamera() {
  map.jumpTo({
    center: TARGET_CENTER,
    zoom: TARGET_ZOOM,
    pitch: TARGET_PITCH,
    bearing: 0
  });
}

map.on("load", async () => {
  map.setSky({
    "sky-color": "#020617",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1e293b",
    "horizon-fog-blend": 0.8,
    "fog-color": "#0f172a",
    "fog-ground-blend": 0.6
  });

  const lidarControl = new LidarControl({
    title: "LiDAR Viewer",
    collapsed: true,
    pointSize: 2,
    colorScheme: "rgb",
    zOffsetEnabled: true,
    zOffset: -700,
    autoZoom: false // <-- clave para quitar el “amago”
  });

  map.addControl(lidarControl, "top-right");
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
  map.addControl(new maplibregl.FullscreenControl(), "top-left");
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true
    }),
    "top-left"
  );
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

  lidarControl.on("load", () => {
    lidarControl.setZOffsetEnabled(true);
    lidarControl.setZOffset(-700);
  });

  try {
    const datasets = await loadDatasets();
    await Promise.all(datasets.map((ds: any) => lidarControl.loadPointCloud(ds.url)));

    // Clavamos cámara (sin animación) y hacemos aparecer el mapa ya estable
    requestAnimationFrame(() => {
      clampCamera();
      setTimeout(clampCamera, 150); // segundo golpe por si acaso
      document.getElementById("map")?.classList.add("ready");
    });
  } catch (e) {
    console.error("Error LiDAR:", e);
    document.getElementById("map")?.classList.add("ready"); // que no se quede invisible si falla
  }
});
