import { startPageViews } from "./page-views";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import { App } from "./App";

startPageViews();

createRoot(document.getElementById("root")!).render(<App />);
