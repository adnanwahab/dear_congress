import { useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { ArgumentMap } from './ArgumentMap';
import { ProposalProvenance } from './ProposalProvenance';
import './proposal-compare.css';

const scope = 'adnanwahab/dear_congress:fictional-demo:v1';
const unknown = 'No evidence supplied';
// Exact public editorial bytes, excluding mutable tallies and all browser/private state.
export function comparisonRevision(item: DemoItem) {
  return JSON.stringify([scope, item.id, item.title, item.topic, item.jurisdiction, item.summary, item.currentText, item.proposedText, item.source, item.sourceUrl, item.background ?? null]);
}
export function comparisonLink(items: DemoItem[]) {
  const params = new URLSearchParams({ compare: JSON.stringify(items.map(item => [item.id, comparisonRevision(item)])) });
  return `/feed?${params}#proposal-comparison`;
}
export function readComparison(search: string, items: DemoItem[]): { items: DemoItem[]; error: string } {
  const raw = new URLSearchParams(search).get('compare');
  if (raw === null) return { items: [], error: '' };
  try {
    if (raw.length > 30000) throw Error();
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length < 2 || entries.length > 3) throw Error();
    const resolved = entries.map(entry => {
      if (!Array.isArray(entry) || entry.length !== 2) throw Error();
      const item = items.find(item => item.id === entry[0]);
      if (!item || comparisonRevision(item) !== entry[1]) throw Error();
      return item;
    });
    if (new Set(resolved.map(item => item.id)).size !== resolved.length) throw Error();
    return { items: resolved, error: '' };
  } catch { return { items: [], error: 'Comparison unavailable: invalid, missing or changed proposal revision. Select 2–3 proposals to create a new link. No newer text has been substituted.' }; }
}

export function ProposalCompare({ items, current, search }: { items: DemoItem[]; current?: DemoItem; search: string }) {
  const linked = readComparison(search, items);
  const [ids, setIds] = useState<string[]>(() => linked.items.map(item => item.id));
  const selected = ids.map(id => items.find(item => item.id === id)).filter((item): item is DemoItem => !!item);
  function toggle(id: string) { setIds(ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id].slice(0, 3)); }
  return <section id="proposal-comparison" className="panel proposal-compare" aria-label="Compare proposals">
    <h2>Compare proposals before an advisory vote</h2>
    <p>Choose 2–3 fictional proposals. Reading, selecting and reordering cast no vote. Compare the stated goal; a shared topic does not establish the same need.</p>
    {linked.error && <p role="alert">{linked.error}</p>}
    <fieldset><legend>Select comparison snapshots</legend>
      {items.map(item => <label key={item.id}><input type="checkbox" checked={ids.includes(item.id)} disabled={!ids.includes(item.id) && ids.length >= 3} onChange={() => toggle(item.id)} />{item.title}</label>)}
    </fieldset>
    {current && <button disabled={!ids.includes(current.id) && ids.length >= 3} onClick={() => toggle(current.id)}>{ids.includes(current.id) ? 'Remove viewed proposal from comparison' : 'Add viewed proposal to comparison'}</button>}
    <p role="status">{selected.length} of 3 selected. {selected.length < 2 ? 'Select at least two proposals.' : 'Comparison ready.'}</p>
    {selected.length >= 2 && <>
      <a href={comparisonLink(selected)}>Open shareable comparison snapshot</a>
      <ol>{selected.map((item, index) => <li key={item.id}>{item.title} <button disabled={index === 0} onClick={() => setIds(previous => { const next = [...previous]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; return next; })}>Move {item.title} earlier</button></li>)}</ol>
      <div className="proposal-compare-scroll" role="region" aria-label="Proposal criteria table; scroll horizontally on small screens" tabIndex={0}>
        <table><caption>Fictional draft snapshots · {scope} · exact editorial bytes bound in share link</caption>
          <thead><tr><th scope="col">Criterion</th>{selected.map(item => <th scope="col" key={item.id}>{item.title}</th>)}</tr></thead>
          <tbody>{([
            ['Goal / stated summary', (item: DemoItem) => item.summary],
            ['Jurisdiction (scenario label, not verified authority)', (item: DemoItem) => item.jurisdiction],
            ['Exact draft text', (item: DemoItem) => item.proposedText],
            ...['Affected groups', 'Authority', 'Estimated cost', 'Time horizon', 'Coverage', 'Reversibility', 'Evidence strength', 'Strongest argument for', 'Strongest concern', 'Unintended effects'].map(label => [label, () => unknown] as const),
          ] as const).map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{selected.map(item => <td key={item.id}>{value(item) || unknown}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <section aria-label="Sources and revision-bound arguments"><h3>Sources and argument maps</h3>{selected.map(item => <article key={item.id}><h4>{item.title}</h4><p>Snapshot: {scope} / {item.id}. The link binds exact draft and editorial fields; changed revisions are unavailable.</p><ProposalProvenance item={item} /><a href={`/draft?proposal=${encodeURIComponent(item.id)}`}>Read source draft</a>{' · '}<a href={`/votes?proposal=${encodeURIComponent(item.id)}`}>Open advisory voting separately</a><ArgumentMap item={item} /></article>)}</section>
      <section aria-label="Synthetic outcomes"><h3>Synthetic outcomes · simulation, not forecast</h3><p>{unknown}. No proposal-level futures have been executed. <a href="/synth">Use the existing frozen package input comparison</a>; package inputs are distinct from these sample proposals.</p></section>
      <section aria-label="Unverified advisory tallies"><h3>Unverified advisory tallies</h3><p>Not used to rank or assess these proposals. Browser choices and synthetic response counts confer no verified authority.</p></section>
      <section aria-label="Official facts"><h3>Official facts</h3><p>{unknown}. These are fictional drafts. Background agency links are not evidence of enactment, cost or effectiveness. Official bill metadata remains in its separate feed section.</p></section>
    </>}
  </section>;
}
