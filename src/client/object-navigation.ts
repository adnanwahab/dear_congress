/** Optional visual metadata only. Native links, focus and scroll history remain authoritative. */
interface Entry { key: string; url: string }
interface Activation { from: Entry | null; entry: Entry }
interface Snapshot {
  id: string; revision: string; from: Entry; to: Entry; href: string; label: string; ordinal: number;
  rect: { x: number; y: number; width: number; height: number }; created: number;
}
const KEY = 'civic_sample_object_navigation_v1';
const NAME = 'sample-navigation-object';
const MAX_AGE = 5 * 60_000;
const selector = '[data-motion-proposal]';

export function validSnapshot(value: unknown, now = Date.now()): value is Snapshot {
  const v = value as Snapshot;
  return !!v && typeof v.id === 'string' && !!v.id &&
    [v.from, v.to].every(e => e && typeof e.key === 'string' && !!e.key && typeof e.url === 'string') &&
    typeof v.revision === 'string' && !!v.revision && typeof v.href === 'string' && typeof v.label === 'string' && Number.isInteger(v.ordinal) && v.ordinal >= 0 &&
    Number.isFinite(v.created) && now >= v.created && now - v.created < MAX_AGE &&
    !!v.rect && [v.rect.x, v.rect.y, v.rect.width, v.rect.height].every(Number.isFinite) && v.rect.width > 0 && v.rect.height > 0;
}

export function installObjectNavigation(target: Window) {
  const doc = target.document;
  type NavigationWindow = Window & { navigation?: { activation?: Activation; currentEntry?: Entry } };
  const navigation = () => (target as NavigationWindow).navigation;
  let pending: { link: HTMLAnchorElement; id: string; event: MouseEvent; created: number } | undefined;
  let restore: (() => void) | undefined;
  const disabled = () => doc.documentElement.dataset.motion === 'off' || !!target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const read = (): Snapshot[] => {
    try { const v: unknown = JSON.parse(target.sessionStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter(x => validSnapshot(x)) : []; } catch { return []; }
  };
  const links = (id: string, href: string) => Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a => a.href === href && a.closest<HTMLElement>(selector)?.dataset.motionProposal === id);
  const visible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return el.isConnected && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < target.innerHeight && r.left < target.innerWidth;
  };
  const mark = (el: HTMLElement, transition: ViewTransition) => {
    restore?.();
    const previous = el.style.viewTransitionName;
    el.style.viewTransitionName = NAME;
    doc.documentElement.dataset.objectNavigation = 'true';
    let done = false;
    restore = () => { if (done) return; done = true; el.style.viewTransitionName = previous; delete doc.documentElement.dataset.objectNavigation; };
    void transition.finished.catch(() => {}).then(restore);
    void transition.ready.catch(() => {});
  };
  // click covers mouse, touch activation and Enter without cancelling navigation.
  doc.addEventListener('click', event => {
    pending = undefined;
    if (disabled() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element)?.closest?.<HTMLAnchorElement>('a[href]');
    if (!link || link.download || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    const id = link.closest<HTMLElement>(selector)?.dataset.motionProposal;
    if (id && url.origin === target.location.origin && url.searchParams.get('proposal') === id && url.href !== target.location.href) pending = { link, id, event, created: Date.now() };
  });
  const apply = (event: Event) => {
    const e = event as Event & { activation?: Activation; viewTransition?: ViewTransition };
    const transition = e.viewTransition;
    const activation = e.activation ?? navigation()?.activation;
    if (!transition || !activation?.from || disabled()) return;
    const { from, entry: to } = activation;
    let records = read();
    if (event.type === 'pageswap' && pending && !pending.event.defaultPrevented && Date.now() - pending.created < 5000 && navigation()?.currentEntry?.key === from.key && visible(pending.link)) {
      const { link, id } = pending;
      pending = undefined;
      if (link.href !== to.url) return;
      const r = link.getBoundingClientRect();
      const revision = link.closest<HTMLElement>(selector)?.dataset.motionRevision;
      if (!revision) return;
      const snapshot: Snapshot = { id, revision, from, to, href: link.href, label: link.textContent ?? '', ordinal: links(id, link.href).indexOf(link), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, created: Date.now() };
      records = [...records.filter(v => v.to.key !== to.key), snapshot].slice(-20);
      try { target.sessionStorage.setItem(KEY, JSON.stringify(records)); } catch { return; }
      mark(link, transition);
      return;
    }
    const forward = records.find(v => v.from.key === from.key && v.to.key === to.key && v.from.url === from.url && v.to.url === to.url);
    const backward = records.find(v => v.to.key === from.key && v.from.key === to.key && v.to.url === from.url && v.from.url === to.url);
    const record = forward ?? backward;
    if (!record) return;
    const atOrigin = (event.type === 'pagereveal') === !!backward;
    const el = atOrigin ? links(record.id, record.href)[record.ordinal] :
      Array.from(doc.querySelectorAll<HTMLElement>(selector)).find(el => el.dataset.motionProposal === record.id && /^H[1-6]$/.test(el.tagName));
    // Missing/virtualized/loading/stale items simply retain ordinary navigation.
    if (atOrigin && el?.textContent !== record.label) return;
    if (el && (el.closest<HTMLElement>(selector)?.dataset.motionRevision === record.revision) && visible(el)) mark(el, transition);
  };
  target.addEventListener('pageswap', apply);
  target.addEventListener('pagereveal', apply);
  target.addEventListener('pageshow', () => { restore?.(); pending = undefined; });
}
