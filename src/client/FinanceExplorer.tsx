import { useEffect, useState } from 'react';
import { financeExample, financeFreshness, reconcileFinance, type FinanceDataset } from '../shared/finance-explorer';
import { TopicChip } from './TopicChip';
import './finance-explorer.css';

export function FinanceExplorer({ dataset = financeExample }: { dataset?: FinanceDataset }) {
  const read = () => new URLSearchParams(window.location.search);
  const [params, setParams] = useState(read);
  useEffect(() => {
    const restore = () => setParams(read());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function update(key: string, value: string) {
    const next = read();
    if (value) next.set(key, value); else next.delete(key);
    window.history.pushState(null, '', `${window.location.pathname}?${next}`); setParams(next);
  }
  let ledger;
  try { ledger = reconcileFinance(params.get('financeData') === 'verified' ? { ...dataset, agencies: [] } : dataset); }
  catch { return <section role="alert">Accounting data incompatible. Reconciliation unavailable; no totals published.</section>; }
  const query = params.get('financeQ') ?? '';
  const level = params.get('financeLevel') ?? '';
  const rows = ledger.rows.filter(a => (!level || a.level === level) && `${a.label} ${a.id}`.toLowerCase().includes(query.toLowerCase()));
  const expanded = (params.get('financeOpen') ?? '').split(',');
  const selected = params.get('financeAgency');
  return <section className="finance-explorer" aria-labelledby="finance-title">
    <h2 id="finance-title">Public finance waterfall by agency</h2>
    <p><strong>Hypothetical teaching example.</strong> Every agency, program, amount and transfer below is invented. No verified cross-government accounting dataset is registered. These figures do not estimate any bill’s cost.</p>
    <TopicChip topic="Government" linked />
    <p><a href="/bills/HFL-051">HFL-051 draft concept</a> · Navigation only; no reviewed funding relationship.</p>
    <p>Compatible example: {dataset.period} · {dataset.basis} basis · {dataset.unit}. Real data must share period, basis, units and matched transfer identities before consolidation.</p>
    <details className="workflow-provenance workflow-provenance-compact"><summary><span className="workflow-source-status">Hypothetical example</span> · Source status · {financeFreshness(dataset.checkedAt)}</summary><p>Source: repository-authored hypothetical-finance-v1 fixture. No independent fiscal evidence or source check date. Unresolved amounts represent incomplete coverage, not inferred spending or available balances.</p></details>
    <label>Accounting dataset<select value={params.get('financeData') ?? 'example'} onChange={e => update('financeData', e.target.value)}><option value="example">Hypothetical example</option><option value="verified">Verified data (not available)</option></select></label>
    <label>Search agencies and programs<input type="search" value={query} onChange={e => update('financeQ', e.target.value)} /></label>
    <label>Government level<select value={level} onChange={e => update('financeLevel', e.target.value)}><option value="">All levels</option>{['Federal','State','County','City'].map(l => <option key={l}>{l}</option>)}</select></label>
    <label><input type="checkbox" checked={params.get('financeStatic') === '1'} onChange={e => update('financeStatic', e.target.checked ? '1' : '')} /> Low-power text view</label>
    {!ledger.rows.length ? <p role="status">No compatible accounting dataset available. No funding or spending total can be established.</p> : <>
      <p>Full example reconciliation (filters do not change totals): external funding {ledger.funding} = final spending {ledger.spending} + unresolved coverage {ledger.unresolved} ({dataset.unit}). Internal transfers are excluded from consolidated spending.</p>
      <p role="status">{rows.length} agencies or programs shown.</p>
      {!rows.length && <p>No agencies match. Clear search and choose All levels.</p>}
      {selected && !ledger.rows.some(a => a.id === selected) && <p>Selected agency unavailable. Choose an agency below.</p>}
      {rows.map(a => <article key={a.id} aria-label={a.label}>
        <h3>{a.label} · {a.level}</h3><p>{a.id} · Hypothetical</p>
        <button aria-pressed={selected === a.id} onClick={() => update('financeAgency', a.id)}>Select {a.label}</button>
        {selected === a.id && <p>Selected agency: {a.label}</p>}
        <p>Final spending: {a.spending}. Cumulative spending: {a.start} → {a.end} {dataset.unit}.</p>
        {params.get('financeStatic') !== '1' && <div className="finance-track" aria-hidden="true"><span style={{ marginInlineStart: `${a.start / (ledger.funding || 1) * 100}%`, width: `${a.spending / (ledger.funding || 1) * 100}%` }} /></div>}
        <button aria-expanded={expanded.includes(a.id)} aria-controls={`finance-${a.id}`} onClick={() => update('financeOpen', (expanded.includes(a.id) ? expanded.filter(id => id !== a.id) : [...expanded.filter(Boolean), a.id]).join(','))}>{expanded.includes(a.id) ? 'Collapse' : 'Expand'} transfers for {a.label}</button>
        <div id={`finance-${a.id}`} hidden={!expanded.includes(a.id)}>
          <p>Receipts {a.received} = transfers {a.transferred} + final spending {a.spending} + unresolved {a.unresolved}. Arithmetic reconciles; coverage is incomplete.</p>
          <ul>{a.transfers.map(t => <li key={t.to}>Transfer to {ledger.rows.find(r => r.id === t.to)?.label}: {t.amount} {dataset.unit}. Matched recipient receipt; excluded from final spending.</li>)}</ul>
          {!a.transfers.length && <p>No onward transfers recorded in this example.</p>}
        </div>
      </article>)}
    </>}
  </section>;
}
