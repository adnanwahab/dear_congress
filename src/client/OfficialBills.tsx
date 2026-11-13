import { useEffect, useState } from 'react';
import { metadataFreshness, type BillObservation } from '../shared/legislation';
export function BillMetadataLane({ bills, now = Date.now() }: { bills: BillObservation[]; now?: number }) {
  return <section className="panel" aria-label="Official bill metadata" style={{ overflowWrap: 'anywhere' }}>
    <h2>Official bill metadata</h2>
    <p>Separate from citizen ideas, drafts and fictional samples. Metadata-only coverage: full text, amendments and complete legal status have not been checked. Enactment does not establish effective dates or measured outcomes.</p>
    {!bills.length && <p>No official bill metadata available. This is not a complete catalog.</p>}
    {bills.map(b => <article key={b.id}>
      <h3>{b.type.toUpperCase()} {b.number} · Congress {b.congress}: {b.title}</h3>
      <p>Introduced bill record · US · {b.chamber} · introduced {b.introducedDate}. Current legal status unverified.</p>
      <p>Sponsor: {b.sponsors.join('; ') || 'Not provided by source'}</p>
      <p>Last reported official action ({b.latestAction.actionDate}): {b.latestAction.text}</p>
      <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">Congress.gov source for {b.type.toUpperCase()} {b.number}, Congress {b.congress}</a>
      <p role="status">{metadataFreshness(b, now)} · metadata retrieved {b.checkedAt} · upstream updated {b.upstreamUpdatedAt ?? 'unknown'}</p>
      <details><summary>Immutable metadata citation</summary><p>SHA-256: {b.sourceHash}</p><p>Exact metadata snapshots are retained by the importer. A hash verifies content consistency; it does not authenticate the source.</p></details>
    </article>)}
  </section>;
}
export function OfficialBills({ request }: { request: <T>(path: string) => Promise<T> }) {
  const [bills, setBills] = useState<BillObservation[]>([]);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    const load = () => request<{ bills: BillObservation[] }>('/api/legislation').then(data => { if (active) { setBills(Array.isArray(data?.bills) ? data.bills : []); setError(false); setLoaded(true); } }).catch(() => { if (active) { setError(true); setLoaded(true); } });
    void load();
    const timer = setInterval(() => { setNow(Date.now()); void load(); }, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [request]);
  return <>{!loaded && <p role="status">Loading official metadata…</p>}{error && <p role="alert">Official metadata unavailable. Any retained records below could not be rechecked.</p>}<BillMetadataLane bills={bills.map(b => error ? { ...b, refreshFailed: true } : b)} now={now} /></>;
}
