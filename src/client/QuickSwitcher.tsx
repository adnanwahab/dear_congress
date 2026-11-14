import { useEffect, useRef, useState } from 'react';
import { matchDestinations, ownsShortcut, SWITCH_DESTINATIONS, type SwitchResult } from './quick-switcher';

export function QuickSwitcher() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [actions, setActions] = useState<SwitchResult[]>([]);
  const results = matchDestinations(query, [...SWITCH_DESTINATIONS, ...actions]);
  const close = () => { dialog.current?.close(); setOpen(false); previousFocus.current?.focus({ preventScroll: true }); };
  const show = () => {
    if (dialog.current?.open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    // Discover real controls rather than offering actions unsupported by this checkout.
    setActions(([
      ['Play the demo', 'a[href="/?demo=1"], [data-action="play-demo"]'],
      ['Switch theme', '[data-action="switch-theme"], button[aria-label="Switch theme"]'],
    ] as const).flatMap(([title, selector]) => {
      const control = document.querySelector<HTMLElement>(selector);
      return control ? [{ id: title, title, type: 'Action', run: () => control.click() }] : [];
    }));
    setQuery(''); setActive(0); setOpen(true);
    dialog.current?.showModal(); input.current?.focus();
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (ownsShortcut(event.target)) return;
      if (document.querySelector('dialog[open]') && !dialog.current?.open) return;
      event.preventDefault(); show();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => { if (open) document.getElementById(`switch-result-${active}`)?.scrollIntoView?.({ block: 'nearest' }); }, [active, open, query]);
  const choose = (result: SwitchResult) => { close(); if (result.href) window.location.assign(result.href); else result.run?.(); };
  return <>
    <button className="quick-switch-trigger" aria-keyshortcuts="Meta+K Control+K" aria-haspopup="dialog" onClick={show}>Search <kbd>⌘K / Ctrl+K</kbd></button>
    <dialog className="quick-switcher" ref={dialog} aria-labelledby="switch-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
      <div className="quick-switch-heading"><h2 id="switch-title">Jump to…</h2><button onClick={close} aria-label="Close quick switcher">Esc</button></div>
      <label htmlFor="switch-query">Search stages, pages, proposals and needs</label>
      <input ref={input} id="switch-query" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="switch-results" aria-activedescendant={results[active] ? `switch-result-${active}` : undefined} autoComplete="off" value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(i => results.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0); }
        if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
      }} />
      <p className="muted" role="status">{results.length ? `${results.length} results. Use ↑ ↓ and Enter.` : 'No matches. Try another search.'}</p>
      <ul id="switch-results" role="listbox" aria-label="Destinations">{results.map((result, index) => <li id={`switch-result-${index}`} key={result.id} role="option" aria-selected={index === active} onMouseDown={e => e.preventDefault()} onClick={() => choose(result)}><span>{result.title}</span><small>{result.type}</small></li>)}</ul>
    </dialog>
  </>;
}
