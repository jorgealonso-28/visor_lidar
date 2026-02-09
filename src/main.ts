import "./style.css";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { LidarControl } from "maplibre-gl-lidar";
import "maplibre-gl-lidar/style.css";

type Dataset = { id: string; name: string; url: string };

async function loadDatasets(): Promise<Dataset[]> {
  const res = await fetch("/datasets.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar /datasets.json");
  const json = await res.json();
  return (json.datasets ?? []) as Dataset[];
}

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: [-3.7038, 40.4168],
  zoom: 12,
  pitch: 60,
  maxPitch: 85,
});

map.on("load", async () => {
  const lidarControl = new LidarControl({
    title: "LiDAR Viewer",
    collapsed: true,
    pointSize: 2,
    colorScheme: "rgb",
    pickable: false,
  });

  map.addControl(lidarControl, "top-right");

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
