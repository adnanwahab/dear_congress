import { transitionDirection } from './view-transitions';

/** Presentation only. Never store ballots, draft text, or server payloads here. */
export interface JourneyEntry {
  version: 1;
  stage: string;
  direction: 'forward' | 'backward' | null;
  proposal: string | null;
  filters: { query: string; topic: string; outcomes: string; jurisdiction: string };
  scroll: [number, number];
  focus: string | null;
}
const key = 'civicJourney';
export function readJourney(target: Window = window): JourneyEntry | null {
  const value = target.history?.state?.[key];
  if (value?.version !== 1 || value.stage !== target.location.pathname
    || !['forward', 'backward', null].includes(value.direction)
    || !(value.proposal === null || typeof value.proposal === 'string')
    || !value.filters || !['query', 'topic', 'outcomes', 'jurisdiction'].every(k => typeof value.filters[k] === 'string')
    || !Array.isArray(value.scroll) || value.scroll.length !== 2 || !value.scroll.every(Number.isFinite)
    || !(value.focus === null || typeof value.focus === 'string')) return null;
  return value;
}
export function writeJourney(value: JourneyEntry, target: Window = window) {
  try { target.history.replaceState({ ...target.history.state, [key]: value }, ''); } catch { /* Native history remains usable when state is unavailable. */ }
}
function focusPath(target: Window): string | null {
  const main = target.document.getElementById('main-content');
  const navigation = target.document.querySelector('nav[aria-label="Main navigation"]');
  let node = target.document.activeElement;
  // Main navigation lives in the header, outside #main-content.
  // Keep restoration bounded to stable controls; never focus arbitrary page text.
  const root = main?.contains(node) ? main : navigation?.contains(node) ? navigation : null;
  if (!root || !node) return null;
  const parts: string[] = [];
  while (node !== root && node.parentElement) {
    const siblings = Array.from(node.parentElement.children).filter(s => s.tagName === node!.tagName);
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
    node = node.parentElement;
  }
  return (root === main ? '#main-content' : 'nav[aria-label="Main navigation"]') + (parts.length ? ' > ' + parts.join(' > ') : '');
}
export function captureJourney(target: Window = window) {
  const entry = readJourney(target);
  if (entry) writeJourney({ ...entry, scroll: [target.scrollX, target.scrollY], focus: focusPath(target) }, target);
}
export function restoreJourney(target: Window = window) {
  const entry = readJourney(target);
  if (!entry) return;
  let focus: HTMLElement | null = null;
  try { focus = entry.focus ? target.document.querySelector(entry.focus) : null; } catch {}
  (focus ?? target.document.getElementById('main-content'))?.focus({ preventScroll: true });
  target.scrollTo({ left: entry.scroll[0], top: entry.scroll[1], behavior: 'instant' });
}
export function installJourneyHistory(target: Window) {
  // Keep native scroll restoration as the fallback, including unsupported engines.
  // Capture before native navigation snapshots; pagehide also covers touch/location.assign.
  target.addEventListener('pagehide', () => captureJourney(target));
  target.addEventListener('pageswap', event => {
    captureJourney(target);
    const activation = (event as Event & { activation?: { from: { url: string } | null; entry: { url: string } } }).activation;
    const entry = readJourney(target);
    if (entry && activation?.from) writeJourney({ ...entry, direction: transitionDirection(activation.from.url, activation.entry.url) }, target);
  });
  target.addEventListener('pagereveal', () => {
    const activation = (target as Window & { navigation?: { activation?: { from: { url: string } | null; entry: { url: string } } } }).navigation?.activation;
    const entry = readJourney(target);
    if (entry && activation?.from) writeJourney({ ...entry, direction: transitionDirection(activation.from.url, activation.entry.url) }, target);
  });
  target.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    const focusedAtReveal = target.document.activeElement;
    target.requestAnimationFrame(() => {
      // BFCache restoration must not steal a visitor's new keyboard focus.
      // A key press can arrive before the deferred restoration frame runs.
      const currentFocus = target.document.activeElement;
      if (currentFocus !== focusedAtReveal && currentFocus !== target.document.body
        && currentFocus !== target.document.documentElement) return;
      restoreJourney(target);
    });
  });
}
