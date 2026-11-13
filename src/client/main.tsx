import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
setWorkerUrl("/assets/maplibre-worker.mjs?v=6.16.0");
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
