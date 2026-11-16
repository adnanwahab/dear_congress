import { useState } from 'react';
import { tabletopDefaults, tabletopDraft, previewTabletop, type TabletopParameters } from '../shared/negotiation-tabletop';

const tiles = [
  { key: 'budget', label: 'Annual budget', min: 0, max: 12000, step: 1000, tradeoff: 'More funding may help qualifying households receive grants; funders may bear more cost. Less funding may leave the draft unaffordable. Tax incidence and funding sources are absent.' },
  { key: 'grant', label: 'Annual grant per household', min: 500, max: 2000, step: 500, tradeoff: 'Higher grants may help qualifying households and cost funders more; lower grants may leave recipients with less support. Welfare effects and administrative costs are absent.' },
  { key: 'ceiling', label: 'Income eligibility ceiling', min: 20000, max: 70000, step: 10000, tradeoff: 'Raising the ceiling includes more fictional households and may cost funders more; lowering it excludes households above the ceiling. Real eligibility rules, household size and legal review are absent.' },
] as const;
export function NegotiationTabletop() {
  const [parameters, setParameters] = useState<TabletopParameters>({ ...tabletopDefaults });
  const [history, setHistory] = useState<TabletopParameters[]>([]);
  const [status, setStatus] = useState('Fictional tabletop ready.');
  const [error, setError] = useState('');
  const result = previewTabletop(parameters);
  function change(next: TabletopParameters) {
    setHistory(previous => [...previous.slice(-99), parameters]); setParameters(next); setStatus('Local draft updated.'); setError('');
  }
  function download() {
    let url: string | undefined;
    try {
      setError('');
      url = URL.createObjectURL(new Blob([JSON.stringify(tabletopDraft(parameters), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'unsigned-negotiation-draft.json'; link.click();
      setStatus('Unsigned draft download requested. No civic action recorded.');
      // Keep the URL alive while the browser begins downloading.
      const downloadUrl = url; setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setError('Download unavailable. Retry or copy the unsigned draft below.');
    }
  }
  return <section className="card" aria-label="Negotiation tabletop">
    <h3>Negotiation tabletop — fictional sandbox</h3>
    <p>Demo only. This is not verified civic participation. No legal text, recorded votes, stored plans or comparison inputs change. All changes stay in this page until reload.</p>
    <p>Drag a tile’s slider, tap its track, or use arrow keys. Undo reverses the last change; Reset restores the starting draft. No motion or network loading is required.</p>
    <p>Fixture: six fictional households with annual incomes $15,000, $25,000, $35,000, $45,000, $55,000 and $65,000. Each income at or below the ceiling qualifies. Annual cost = qualifying count × grant, in USD. These are disclosed assumptions, not fiscal evidence.</p>
    {tiles.map(tile => <fieldset key={tile.key}>
      <legend>{tile.label} tile</legend>
      <label>{tile.label}: ${parameters[tile.key].toLocaleString('en-US')}
        <input style={{ width: '100%', minHeight: 44 }} type="range" min={tile.min} max={tile.max} step={tile.step} value={parameters[tile.key]}
          aria-label={tile.label} aria-describedby={`tabletop-${tile.key}`} onInput={event => change({ ...parameters, [tile.key]: Number(event.currentTarget.value) })} />
      </label>
      <p id={`tabletop-${tile.key}`}>Who may gain or lose: {tile.tradeoff}</p>
    </fieldset>)}
    <p role="status" aria-live="polite">{status} {result.eligible} qualifying; {result.excluded} excluded. Annual cost ${result.cost.toLocaleString('en-US')}. {result.fits ? `Within budget; $${result.balance.toLocaleString('en-US')} remaining.` : `Over budget by $${(-result.balance).toLocaleString('en-US')}; no households automatically selected or denied.`}</p>
    <p>Missing evidence: take-up, real household data, funding sources, independently sourced cost estimates, legal eligibility review and distributional impacts. Housing, health and other welfare outcomes remain unknown. No unsupported outcome estimate is offered.</p>
    <button type="button" disabled={!history.length} onClick={() => { setParameters(history[history.length - 1]!); setHistory(history.slice(0, -1)); setStatus('Last concession undone.'); }}>Undo concession</button>{' '}
    <button type="button" onClick={() => change({ ...tabletopDefaults })}>Reset tabletop</button>{' '}
    <button type="button" onClick={download}>Export unsigned proposal draft</button>
    {error && <p role="alert">{error}</p>}
    <details><summary>Inspect or copy unsigned draft and provenance</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(tabletopDraft(parameters), null, 2)}</pre></details>
  </section>;
}
