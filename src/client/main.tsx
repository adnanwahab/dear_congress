import { startPageViews } from "./page-views";
import { createRoot } from "react-dom/client";
import { App } from "./App";

startPageViews();

createRoot(document.getElementById("root")!).render(<App />);
