import { useId, useState } from 'react';
import { CALENDAR_EVIDENCE, dateValue, evidenceExport, reviewDue, reviewWarning, safeEvidenceUrl, type ClaimProvenance } from '../shared/evidence-freshness';
import './evidence-calendar.css';

export function EvidenceCalendar({ rows = CALENDAR_EVIDENCE, asOf = new Date().toISOString().slice(0, 10), state = 'ready' }: { rows?: readonly ClaimProvenance[]; asOf?: string; state?: 'ready' | 'loading' | 'error' | 'offline' }) {
  const id = useId();
  const [month, setMonth] = useState(asOf.slice(0, 7));
  const [selected, setSelected] = useState('');
  const [exported, setExported] = useState(false);
  const events = rows.flatMap(row => ([['Published', row.published], ['Observed', row.observed], ['Retrieved', row.retrieved], ['Review due', reviewDue(row)]] as const).filter(([, date]) => dateValue(date) !== null).map(([kind, date]) => ({ row, kind, date: date! })));
  const visible = events.filter(event => event.date.startsWith(month) && (!selected || event.row.id === selected)).sort((a,b) => a.date.localeCompare(b.date));
  return <section className="evidence-calendar panel" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Evidence freshness calendar</h2>
    <p>Publication age is separate from validity. Old sources are not automatically false. Expiry warnings mean a review interval has elapsed, not that evidence has been disproved.</p>
    {state !== 'ready' && <p role="status">{state === 'loading' ? 'Loading sources; bundled editorial snapshot remains available.' : state === 'offline' ? 'Offline: bundled snapshot only; external sources cannot be checked here.' : 'Source update unavailable. Showing bundled snapshot; no new retrieval is claimed.'}</p>}
    <p>Assessed as of {asOf}. Read-only metadata; no live source refresh or human approval is performed here.</p>
    <div className="evidence-controls">
      <label htmlFor={`${id}-month`}>Calendar month <input id={`${id}-month`} type="month" value={month} onInput={e => setMonth(e.currentTarget.value)} /></label>
      <label htmlFor={`${id}-claim`}>Claim <select id={`${id}-claim`} value={selected} onChange={e => setSelected(e.target.value)}><option value="">All claims</option>{rows.map(row => <option key={row.id} value={row.id}>{row.claim}</option>)}</select></label>
      <button type="button" onClick={() => setExported(!exported)}>Export dated evidence</button>
      <button type="button" onClick={() => { setExported(true); }}>Prepare print view</button>
    </div>
    <p role="status">{visible.length} dated events in {month || 'the selected month'}. Unknown dates remain in the source ledger below.</p>
    <ol aria-label="Calendar agenda">{visible.map(event => <li key={`${event.row.id}-${event.kind}`}><time dateTime={event.date}>{event.date}</time> · {event.kind} · <a href={`#${id}-${event.row.id}`}>{event.row.claim}</a></li>)}</ol>
    {!visible.length && <p>No dated events this month. Choose another month or read the ledger.</p>}
    <div className="evidence-ledger">{rows.filter(row => !selected || selected === row.id).map(row => <article id={`${id}-${row.id}`} key={row.id}>
      <h3>{row.claim}</h3><p>Publication age: {dateValue(row.published) !== null && dateValue(asOf) !== null && dateValue(row.published)! <= dateValue(asOf)! ? `${Math.floor((dateValue(asOf)! - dateValue(row.published)!) / 86400000)} days` : 'Unknown'}. Validity is not assessed by age.</p><p><strong>{row.kind}</strong> · {reviewWarning(row, asOf)}</p>
      <p>Source identity: {row.sourceId}</p>
      {safeEvidenceUrl(row.sourceUrl) ? <a href={safeEvidenceUrl(row.sourceUrl)!} target="_blank" rel="noopener noreferrer">Original source (opens in a new tab)</a> : <p>Source missing or unavailable</p>}
      <dl>{([['Published', row.published], ['Observed', row.observed], ['Retrieved', row.retrieved], ['Review interval begins', row.reviewFrom], ['Review due', reviewDue(row)]] as const).map(([label,date]) => <div key={label}><dt>{label}</dt><dd>{dateValue(date) === null ? 'Unknown' : <time dateTime={date!}>{date}</time>}</dd></div>)}</dl>
      <p>Review interval: {row.reviewDays} days. {row.limitations}</p>
      <details><summary>Provenance and human-review history</summary>{row.review.length ? <ul>{row.review.map((entry,i) => <li key={i}>{entry.recordedAt} · {entry.revision} · {entry.actor} · {entry.state} · {entry.change}</li>)}</ul> : <p>No human review recorded. Existing source identity retained; dates were not backfilled.</p>}</details>
    </article>)}</div>
    <p>Print fallback: use your browser’s Print command. The full source ledger is included. External links may be unavailable offline.</p>
    {exported && <label>Copyable JSON export (also printable)<textarea readOnly rows={12} value={evidenceExport(rows, asOf)} /></label>}
  </section>;
}
