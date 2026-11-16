declare const MAPLIBRE_CSS_URL: string;
declare const MAPLIBRE_WORKER_URL: string;
// Called only by mounted map views, after confirming a map style is configured.
// Keep the stylesheet out of the HTML entry's eagerly bundled CSS.
export function loadMapLibre() {
  if (!document.querySelector('link[data-maplibre]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = typeof MAPLIBRE_CSS_URL === "string" ? MAPLIBRE_CSS_URL : "/maplibre.css";
    link.dataset.maplibre = "true";
    document.head.append(link);
  }
  return import("maplibre-gl").then(map => {
    if (typeof MAPLIBRE_WORKER_URL === "string") map.setWorkerUrl(MAPLIBRE_WORKER_URL);
    return map;
  });
}
