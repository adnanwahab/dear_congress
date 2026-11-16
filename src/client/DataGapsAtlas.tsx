import { useState } from 'react';
import { DATA_GAPS, exportGaps, filterGaps } from '../shared/data-gaps';
import './data-gaps.css';

export function DataGapsAtlas() {
  const [filters, setFilters] = useState({ jurisdiction: '', topic: '', category: '', query: '' });
  const [exportError, setExportError] = useState('');
  const rows = filterGaps(DATA_GAPS, filters);
  function download() {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([exportGaps(rows)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'public-data-gaps.json'; link.click();
      const created = url; setTimeout(() => URL.revokeObjectURL(created), 1000); setExportError('');
    } catch { if (url) URL.revokeObjectURL(url); setExportError('Download unavailable. Open the export text below and save it, or use your browser’s Print command.'); }
  }
  return <section className="panel data-gaps" aria-labelledby="data-gaps-title" id="data-gaps-atlas" tabIndex={-1}>
    <h2 id="data-gaps-title">Public-data gaps atlas</h2>
    <p>Missing evidence means unknown, never good outcomes. This small research inventory is not a comprehensive coverage map. All entries await human review.</p>
    <p>Bundled inventory · revision atlas-v1 · 2026-11-14. Available after page load without network requests; external sources may be unavailable offline. No live refresh or loading measurement is implied.</p>
    <div className="gap-controls">
      {(['jurisdiction', 'topic', 'category'] as const).map(key => <label key={key}>{key === 'category' ? 'Gap category' : key === 'topic' ? 'Topic' : 'Jurisdiction'}<select aria-label={key === 'category' ? 'Gap category' : key === 'topic' ? 'Topic' : 'Jurisdiction'} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}><option value="">All</option>{[...new Set(DATA_GAPS.map(row => row[key]))].map(value => <option key={value}>{value}</option>)}</select></label>)}
      <label>Metric or research question<input type="search" value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} /></label>
      <button type="button" onClick={() => setFilters({ jurisdiction: '', topic: '', category: '', query: '' })}>Reset filters</button>
    </div>
    <p role="status">{rows.length} of {DATA_GAPS.length} research cases shown</p>
    {!rows.length && <p>No matching cases in this inventory. This does not establish coverage or good outcomes. Reset filters to see all cases.</p>}
    <ul className="gap-grid" aria-label="Jurisdiction and metric evidence grid">{rows.map(row => <li key={row.id} className="card">
      <h3>{row.metric}</h3><p>{row.jurisdiction} · {row.topic} · <strong>{row.category}</strong></p>
      <p>Last source observation: {row.claims.flatMap(c => c.observedAt ? [c.observedAt] : []).sort().at(-1) ?? 'None registered'} (source inspection date, not measurement period)</p>
      {row.claims.map((claim, i) => <div key={i} className="gap-claim"><h4>{claim.kind}</h4><p>{claim.text}</p><p>Period: {claim.period} · Source inspected: {claim.observedAt ?? 'Not observed'}</p>{claim.source ? <p><a href={claim.source.url}>{claim.source.publisher} — {claim.source.locator}</a></p> : <p>No primary source attached to this claim.</p>}<p>Limitations: {claim.limitations}</p></div>)}
      <h4>Next research question</h4><p>{row.question}</p>
      <p>{row.agency ? <><a href={row.agency.url}>{row.agency.name}</a> · {row.agency.basis}</> : 'Responsible agency not established for this case.'}</p>
      <details><summary>Provenance and review history: {row.metric}</summary><ul>{row.history.map(event => <li key={event.revision}>{event.revision} · {event.date} · {event.author} · {event.review}. {event.reason}</li>)}</ul></details>
    </li>)}</ul>
    <button type="button" onClick={download}>Export visible cases (JSON)</button>
    {exportError && <p role="alert">{exportError}</p>}
    <details className="gap-export"><summary>Export text and print fallback</summary><p>The export retains sources, dates, limitations, questions and review history for the current filters. Select and copy this text if downloads fail. Browser Print includes the visible cases and expanded provenance; use Reset filters first for the full inventory.</p><pre tabIndex={0}>{exportGaps(rows)}</pre></details>
    <p><a href="/documentation#sources-and-methodology">Sources and methodology</a></p>
  </section>;
}
