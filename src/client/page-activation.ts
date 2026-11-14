/** Start activation-only effects now, or once when a speculative document is shown. */
export function onPageActivation(start: () => void | (() => void), page: Document = document) {
  let cleanup: void | (() => void);
  const activate = () => { cleanup = start(); };
  if ((page as Document & { prerendering?: boolean }).prerendering) {
    page.addEventListener('prerenderingchange', activate, { once: true });
  } else activate();
  return () => { page.removeEventListener('prerenderingchange', activate); cleanup?.(); };
}
