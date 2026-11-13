import { createRoot } from "react-dom/client";
import { App } from "./App";
import { flushSync } from "react-dom";
import { installStageSwipe } from "./stage-swipe";
import { installViewTransitions } from "./view-transitions";

installViewTransitions(window);
installStageSwipe(window);
// Commit the shell before the render-blocking module releases the incoming snapshot.
flushSync(() => createRoot(document.getElementById("root")!).render(<App />));
