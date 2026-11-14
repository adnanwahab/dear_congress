/** Keep focus trapped in the modal until its shared CSS exit has finished. */
export function closeDialog(dialog: HTMLDialogElement, afterClose: () => void): () => void {
  let cancelled = false;
  const finish = () => {
    if (cancelled) return;
    delete dialog.dataset.closing;
    if (dialog.open) dialog.close();
    afterClose();
  };
  const view = dialog.ownerDocument.defaultView;
  if (!view?.CSS?.supports('transition-behavior', 'allow-discrete') ||
      !view.CSS.supports('overlay', 'auto') ||
      view.matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.getAnimations) {
    finish();
    return () => {};
  }
  // Resolve the open style before changing it, including a close during entry.
  view.getComputedStyle(dialog).opacity;
  dialog.dataset.closing = '';
  view.getComputedStyle(dialog).opacity;
  const animations = dialog.getAnimations();
  void Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
  return () => { cancelled = true; delete dialog.dataset.closing; };
}
