import { CIVIC_STAGES } from '../shared/civic-stages';

/** Only the six civic stages have a direction; utilities use the default fade. */
export function transitionDirection(from: string, to: string): 'forward' | 'backward' | null {
  // Navigation entries may hide or omit their URL; transitions are optional.
  let source:URL,destination:URL;
  try{source=new URL(from);destination=new URL(to);}catch{return null;}
  if (source.origin !== destination.origin) return null;
  const index = (url: URL) => {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return CIVIC_STAGES.findIndex(stage => stage.route === (path === '/vote' ? '/votes' : path));
  };
  const a = index(source), b = index(destination);
  return a < 0 || b < 0 || a === b ? null : b > a ? 'forward' : 'backward';
}

type Activation = { from: { url: string } | null; entry: { url: string } };
type TransitionEvent = Event & {
  activation?: Activation;
  viewTransition?: { types?: { add(type: string): void; delete(type: string): void } };
};

export function installViewTransitions(target: Window) {
  const apply = (event: Event) => {
    const e = event as TransitionEvent;
    const types = e.viewTransition?.types;
    if (!types) return;
    types.delete('forward');
    types.delete('backward');
    const activation = e.activation ?? (target as Window & { navigation?: { activation?: Activation } }).navigation?.activation;
    if (!activation?.from) return;
    const direction = transitionDirection(activation.from.url, activation.entry.url);
    if (direction) types.add(direction);
  };
  target.addEventListener('pageswap', apply);
  target.addEventListener('pagereveal', apply);
}

/** Ordinary same-tab anchors retain native navigation and modified-click behavior. */
export function prepareStageMorph(event: {
  defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean;
  shiftKey: boolean; altKey: boolean; currentTarget: HTMLAnchorElement;
}, stage: number) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.currentTarget;
  const card = link.closest<HTMLElement>('.stage-card');
  if (!card) return;
  card.style.viewTransitionName = `journey-stage-${stage}`;
  // BFCache restores the source DOM, so discard the outgoing snapshot identity.
  link.ownerDocument.defaultView?.addEventListener('pageshow', () => {
    card.style.viewTransitionName = '';
  }, { once: true });
}
