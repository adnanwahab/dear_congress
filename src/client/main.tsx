import { installMotion } from "./motion";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { flushSync } from "react-dom";
import { installStageSwipe } from "./stage-swipe";
import { installViewTransitions } from "./view-transitions";

installMotion(window);
import { installScrollReveals } from "./scroll-motion";

installViewTransitions(window);
installStageSwipe(window);
// Commit the shell before the render-blocking module releases the incoming snapshot.
flushSync(() => createRoot(document.getElementById("root")!).render(<><a className="skip-navigation" href="#main-content" onClick={event => { const main = document.getElementById("main-content"); if (main) { event.preventDefault(); main.focus(); main.scrollIntoView({ block: "start" }); } }}>Skip to main content</a><App /></>));

installScrollReveals(document.getElementById("root")!);
