// Called only by mounted map views, after confirming a map style is configured.
// Keep the stylesheet out of the HTML entry's eagerly bundled CSS.
export function loadMapLibre() {
  if (!document.querySelector('link[data-maplibre]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/maplibre.css";
    link.dataset.maplibre = "true";
    document.head.append(link);
  }
  return import("maplibre-gl");
}
