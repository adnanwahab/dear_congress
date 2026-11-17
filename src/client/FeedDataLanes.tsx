import { lazy, Suspense, useEffect } from 'react';
import { OfficialBills } from './OfficialBills';

const Concepts = lazy(() => import('./FeedConcepts'));
const lanes = { fictional: 'Fictional samples', concepts: 'Unreviewed concepts', official: 'Official source references' } as const;
export type FeedLane = keyof typeof lanes;
export function readFeedLane(): FeedLane {
  const value = new URLSearchParams(window.location.search).get('lane');
  return value === 'concepts' || value === 'official' ? value : 'fictional';
}
export function FeedDataLanes({ lane, onChange, request }: {
  lane: FeedLane; onChange: (lane: FeedLane) => void;
  request: <T>(path: string) => Promise<T>;
}) {
  useEffect(() => {
    const restore = () => onChange(readFeedLane());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [onChange]);
  function select(value: FeedLane) {
    const url = new URL(window.location.href);
    url.searchParams.set('lane', value);
    window.history.pushState(null, '', url);
    onChange(value);
  }
  return <section aria-label="Feed data lanes">
    <h2>Choose a data lane</h2>
    <div className="topic-filters" role="group" aria-label="Data lane">{Object.entries(lanes).map(([key, label]) => <button type="button" key={key} aria-pressed={lane === key} onClick={() => select(key as FeedLane)}>{label}</button>)}</div>
    <p>One data type at a time. Counts and filters belong only to the selected lane; clearing filters keeps that lane. Fictional samples are the default.</p>
    <p>Participation is non-binding and advisory. Official references supply metadata only; they do not verify draft claims, measured outcomes or modeled futures.</p>
    {lane === 'concepts' && <Suspense fallback={<p role="status">Loading unreviewed concepts…</p>}><Concepts /></Suspense>}
    {lane === 'official' && <OfficialBills request={request} />}
  </section>;
}
