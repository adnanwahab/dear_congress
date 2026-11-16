import { motionDisabled } from './motion';
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
  viewTransition?: { types?: { add(type: string): void; delete(type: string): void }; skipTransition?(): void; finished?: Promise<void>; ready?: Promise<void> };
};

export function installViewTransitions(target: Window) {
  let active: TransitionEvent['viewTransition'];
  let revision = 0;
  const interrupt = () => {
    revision++;
    active?.skipTransition?.();
    active = undefined;
  };
  // Observe native navigation; never intercept it or replay a destination.
  const navigation = (target as Window & { navigation?: EventTarget }).navigation;
  navigation?.addEventListener?.('navigate', interrupt);
  target.addEventListener('pagehide', interrupt);
  target.addEventListener('click', event => {
    const click = event as MouseEvent;
    const link = (click.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!click.defaultPrevented && click.button === 0 && !click.metaKey && !click.ctrlKey &&
        !click.shiftKey && !click.altKey && link && !link.download && (!link.target || link.target === '_self')) interrupt();
  });
  const apply = (event: Event) => {
    const e = event as TransitionEvent;
    interrupt();
    const transition = e.viewTransition;
    active = transition;
    const current = revision;
    if (transition) {
      if (motionDisabled()) transition.skipTransition?.();
      void transition.ready?.catch(() => {});
      // A skipped/failed snapshot must still hand focus to the committed document.
      void Promise.resolve(transition.finished).catch(() => {}).then(() => {
        if (current !== revision) return;
        active = undefined;
      });
    }
    if (event.type === 'pagereveal') {
      const activation = e.activation ?? (target as Window & { navigation?: { activation?: Activation } }).navigation?.activation;
      if (activation?.from) {
        // Do not wait for animation, steal focus from a hash target, or replace
        // focus restored by history/BFCache or by the visitor.
        const main = target.document?.getElementById('main-content');
        const focused = target.document?.activeElement;
        if (!target.location?.hash && main && (!focused || focused === target.document.body)) main.focus({ preventScroll: true });
      }
    }
    const types = transition?.types;
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
