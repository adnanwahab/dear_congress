import { createRoot } from "react-dom/client";
import { App } from "./App";
import { flushSync } from "react-dom";
import { installViewTransitions } from "./view-transitions";

import { installScrollReveals } from "./scroll-motion";

installViewTransitions(window);
// Commit the shell before the render-blocking module releases the incoming snapshot.
flushSync(() => createRoot(document.getElementById("root")!).render(<App />));

installScrollReveals(document.getElementById("root")!);
