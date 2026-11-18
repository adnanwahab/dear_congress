import { useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DemoItem } from '../engine/demo';
import { ProposalProvenance } from './ProposalProvenance';
import './research-desk.css';

export const DESK_KEY = 'civic_research_layout_v1';
type Layout = { widths: number[]; stacked: boolean };
const DEFAULT: Layout = { widths: [34, 33, 33], stacked: false };
export function readDeskLayout(): Layout {
  try {
    const value = JSON.parse(window.localStorage.getItem(DESK_KEY) ?? 'null');
    if (value?.version === 1 && typeof value.stacked === 'boolean' && Array.isArray(value.widths) && value.widths.length === 3 && value.widths.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 20 && n <= 60) && Math.abs(value.widths.reduce((a: number, b: number) => a + b, 0) - 100) < .01) return value;
  } catch { /* Browser storage is optional. */ }
  return { ...DEFAULT, widths: [...DEFAULT.widths] };
}
export function resizeDesk(widths: number[], index: number, delta: number) {
  const next = [...widths];
  const change = Math.max(20 - next[index]!, Math.min(next[index + 1]! - 20, delta));
  next[index] = next[index]! + change;
  next[index + 1] = next[index + 1]! - change;
  return next;
}

/** Exact loaded sample only: no inferred citations, measurements or vote authority. */
export function ResearchDesk({ item }: { item: DemoItem }) {
  const id = useId();
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; start: number; width: number; widths: number[]; index: number } | null>(null);
  const [layout, setLayout] = useState(readDeskLayout);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const save = (next: Layout) => {
    setLayout(next);
    try { window.localStorage.setItem(DESK_KEY, JSON.stringify({ version: 1, ...next })); setStatus('Layout saved in this browser.'); }
    catch { setStatus('Layout is available for this page only; browser storage is unavailable.'); }
  };
  const links = [{ key: 'current', label: 'Current-rule illustration', text: item.currentText }, { key: 'proposal', label: 'Proposed clause', text: item.proposedText }, { key: 'outcome', label: 'Intended outcome', text: item.summary }];
  const passage = (key: string, label: string, text: string) => <div className="research-passage" data-linked={selected === key || undefined}><button aria-pressed={selected === key} onClick={() => setSelected(selected === key ? null : key)}>{label}{selected === key ? ' · Highlighted across panes' : ''}</button><p>{text}</p></div>;
  const separator = (index: number) => <div className="research-resizer" role="separator" tabIndex={0} aria-label={`Resize ${index === 0 ? 'text and sources' : 'sources and outcome graph'}`} aria-orientation="vertical" aria-controls={`${id}-pane-${index} ${id}-pane-${index + 1}`} aria-valuemin={20} aria-valuemax={Math.round(layout.widths[index]! + layout.widths[index + 1]! - 20)} aria-valuenow={Math.round(layout.widths[index]!)} aria-valuetext={`${Math.round(layout.widths[index]!)} percent of desk`} onKeyDown={e => {
    const delta = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : e.key === 'Home' ? -100 : e.key === 'End' ? 100 : null;
    if (delta !== null) { e.preventDefault(); save({ ...layout, widths: resizeDesk(layout.widths, index, delta) }); }
  }} onPointerDown={e => {
    if (e.button !== 0) return;
    const width = grid.current?.getBoundingClientRect().width ?? 0;
    if (!width) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointer: e.pointerId, start: e.clientX, width, widths: [...layout.widths], index };
  }} onPointerMove={e => {
    const start = drag.current;
    if (start?.pointer === e.pointerId) setLayout({ ...layout, widths: resizeDesk(start.widths, start.index, (e.clientX - start.start) / start.width * 100) });
  }} onPointerUp={e => { if (drag.current?.pointer === e.pointerId) { drag.current = null; save(layout); } }} onPointerCancel={() => { if (drag.current) setLayout({ ...layout, widths: drag.current.widths }); drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} />;
  return <section id="research-desk" className="panel research-desk" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Linked research desk</h2>
    <p>{item.title} · Fictional sample, not introduced bill text. Highlighting shows editorial relationships, not evidence verification.</p>
    <label><input type="checkbox" checked={layout.stacked} onChange={e => save({ ...layout, stacked: e.target.checked })} /> Use single column</label>{' '}
    <button onClick={() => save({ ...DEFAULT, widths: [...DEFAULT.widths] })}>Reset desk layout</button>
    <p>Drag a divider or focus it and use Left/Right (2%), Home/End (limits). Narrow screens always show one column. Select the same labeled passage from any pane; selection never moves focus.</p>
    <p role="status">{status}</p>
    <div ref={grid} className="research-grid" data-stacked={layout.stacked} style={{ '--desk-columns': `${layout.widths[0]}fr 24px ${layout.widths[1]}fr 24px ${layout.widths[2]}fr` } as CSSProperties}>
      <section id={`${id}-pane-0`} aria-labelledby={`${id}-text`}><h3 id={`${id}-text`}>Bill / proposal text</h3>{links.map(link => <div key={link.key}>{passage(link.key, link.label, link.text)}</div>)}</section>
      {separator(0)}
      <section id={`${id}-pane-1`} aria-labelledby={`${id}-sources`}><h3 id={`${id}-sources`}>Sources</h3><ProposalProvenance item={item} />{links.map(link => <div key={link.key}>{passage(link.key, link.label, 'No claim-level citation supplied. The background reference does not verify this passage.')}</div>)}</section>
      {separator(1)}
      <section id={`${id}-pane-2`} aria-labelledby={`${id}-graph`}><h3 id={`${id}-graph`}>Outcome graph · illustrative</h3><p>Reading order: current-rule illustration → proposed clause → intended outcome. This is a hypothesis, not a measured causal relationship.</p><ol>{links.map(link => <li key={link.key}>{passage(link.key, link.label, link.text)}</li>)}</ol><p>No measured outcome or verified causal evidence is supplied for this sample.</p></section>
    </div>
  </section>;
}
