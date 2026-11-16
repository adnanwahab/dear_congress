import { useState } from 'react';
import { saveJourneyEntry, type JourneyCategory, type JourneyEntry } from './civic-journey';
/** Explicit snapshots only. Never pass authentication, ownership or retry credentials. */
export default function SaveToJourney({ category, kind, text }: { category: JourneyCategory; kind: JourneyEntry['kind']; text: string }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  return <div><button type="button" onClick={() => {
    try { saveJourneyEntry(localStorage, { id: crypto.randomUUID(), savedAt: new Date().toISOString(), category, kind, text }); setError(''); setStatus('Snapshot saved only in this browser.'); }
    catch (e) { setStatus(''); setError(`Could not save journey snapshot: ${String(e)}`); }
  }}>Save {category.toLowerCase()} snapshot privately</button><p>Optional browser-local copy. Anyone using this profile can read it. <a href="/account">View, export or delete your journey</a>. This editable copy is not a verified receipt or eligibility evidence.</p><p role="status">{status}</p>{error && <p role="alert">{error}</p>}</div>;
}
