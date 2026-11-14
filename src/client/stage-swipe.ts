import { CIVIC_STAGES, stageRoute } from '../shared/civic-stages';

export function swipeDestination(path: string, dx: number, dy: number, proposal: string | null) {
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return null;
  const index = CIVIC_STAGES.findIndex(s => s.route === (path === '/vote' ? '/votes' : path.replace(/\/+$/, '')));
  const next = index < 0 ? undefined : CIVIC_STAGES[index + (dx < 0 ? 1 : -1)];
  return next ? stageRoute(next.route.slice(1) as keyof typeof import('../shared/civic-stages').STAGES, proposal) : null;
}

/** Leave native scrolling, interactive controls and map gestures to their owners. */
export function installStageSwipe(target: Window) {
  let start: { id: number; x: number; y: number } | null = null;
  const cancel = () => { start = null; };
  target.addEventListener('pointerdown', e => {
    if (start || !e.isPrimary) { cancel(); return; }
    if (e.pointerType !== 'touch' || !target.matchMedia('(max-width: 600px)').matches) return;
    let node = e.target instanceof Element ? e.target : null;
    if (!node?.closest('.workflow-main') || node.closest('a,button,input,select,textarea,dialog,[contenteditable],canvas,[role="slider"],[data-no-stage-swipe]')) return;
    for (; node && node !== target.document.body; node = node.parentElement) {
      const style = target.getComputedStyle(node);
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) return;
    }
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  target.addEventListener('pointermove', e => {
    if (start && e.pointerId === start.id && Math.abs(e.clientY - start.y) > 20 && Math.abs(e.clientY - start.y) > Math.abs(e.clientX - start.x)) cancel();
  });
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('pointerup', e => {
    const origin = start;
    cancel();
    if (!origin || origin.id !== e.pointerId) return;
    const href = swipeDestination(target.location.pathname, e.clientX - origin.x, e.clientY - origin.y, new URLSearchParams(target.location.search).get('proposal'));
    if (href) target.location.assign(href); // Same document-navigation path as stage links; SHE-323 supplies motion.
  });
}
