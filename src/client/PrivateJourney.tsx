import { useEffect, useState } from 'react';
import { deleteJourneyEntry, JOURNEY_CATEGORIES, JOURNEY_KEY, JOURNEY_KINDS, readJourney, saveJourneyEntry, type JourneyCategory, type JourneyEntry } from './civic-journey';

export default function PrivateJourney() {
  const [entries, setEntries] = useState<JourneyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState<JourneyCategory>('Topics');
  const [kind, setKind] = useState<JourneyEntry['kind']>('Personal learning');
  const [text, setText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  function reload() {
    try { setEntries(readJourney(localStorage)); setError(''); }
    catch (e) { setError(`Could not read private history. ${String(e)} Nothing has been replaced.`); }
    setLoading(false);
  }
  useEffect(() => { reload(); const sync = (e: StorageEvent) => { if (e.key === JOURNEY_KEY || e.key === null) reload(); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  function change(action: () => void, message: string) {
    try { action(); reload(); setStatus(message); }
    catch (e) { setStatus(''); setError(`Could not update private history. ${String(e)}`); }
  }
  function download() {
    try {
      const raw = localStorage.getItem(JOURNEY_KEY);
      const url = URL.createObjectURL(new Blob([raw ?? JSON.stringify({ version: 1, entries: [] })], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'private-civic-journey.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Export prepared. The file contains your private notes; store it carefully.');
    } catch { setError('Could not export private history. Browser storage or downloads may be unavailable.'); }
  }
  return <section className="panel private-journey" aria-labelledby="private-journey-heading">
    <h2 id="private-journey-heading">Your private civic journey</h2>
    <p>Save what you explored and learned, only when you choose. Notes stay in this browser profile; nothing here is sent to the service. Others using this profile and scripts on this origin can read them. Storage is not encrypted, backed up or synced.</p>
    <p>This editable personal history is not evidence of verified civic eligibility, a vote receipt, or merge authority. Manual vote notes are self-recorded recollections. Source snapshots record a previously loaded choice and can become outdated after changes or withdrawal. Fiction and model results remain labelled separately.</p>
    <p>Existing saved work stays in its original location: <a href="/proposals/new">proposal drafts</a>, <a href="/proposals/new?guided=1">private workspace</a> and <a href="/outcomes#watchlist">followed proposals</a>. Use Save snapshot privately in those screens to add an explicit copy here. Deleting a snapshot does not delete the original record. Unsaved activity and past votes are not automatically reconstructed.</p>
    <form onSubmit={e => { e.preventDefault(); change(() => { saveJourneyEntry(localStorage, { id: crypto.randomUUID(), savedAt: new Date().toISOString(), category, kind, text: text.trim() }); setText(''); }, 'Learning note saved privately.'); }}>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value as JourneyCategory)}>{JOURNEY_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Activity source<select value={kind} onChange={e => setKind(e.target.value as JourneyEntry['kind'])}>{JOURNEY_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
      <label>What did you explore or learn?<textarea required maxLength={4000} value={text} onChange={e => setText(e.target.value)} rows={3} /></label>
      <p>Include a topic, draft title, sandbox recipe/seed or explicit vote choice and proposal identity as needed. Do not include sensitive personal details. Saving a note never casts a vote or runs a model.</p>
      <button disabled={loading || !!error || !text.trim()} type="submit">Save learning note privately</button>
    </form>
    <div className="private-journey-actions"><button type="button" onClick={download}>Export private journey</button><button type="button" onClick={() => setConfirmReset(true)}>Reset private journey…</button><button type="button" onClick={reload}>Reload private journey</button></div>
    {confirmReset && <div><p>Delete all notes in this journey? Export first if you need a copy. Published records, votes, drafts, follows and browser identity remain unchanged.</p><button type="button" onClick={() => change(() => { localStorage.removeItem(JOURNEY_KEY); setConfirmReset(false); }, 'Private journey reset.')}>Delete all journey notes</button> <button type="button" onClick={() => setConfirmReset(false)}>Cancel reset</button></div>}
    <p role="status">{loading ? 'Loading private journey…' : status}</p>
    {error && <p role="alert">{error}</p>}
    {!loading && !error && JOURNEY_CATEGORIES.map(c => <section key={c} aria-label={c}><h3>{c}</h3>{!entries.some(e => e.category === c) && <p>No saved {c.toLowerCase()} notes yet.</p>}<ol>{entries.filter(e => e.category === c).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map(e => <li key={e.id}><p><strong>{e.kind}</strong> · <time dateTime={e.savedAt}>{new Date(e.savedAt).toLocaleString()}</time> · saved locally</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text}</p><button type="button" aria-label={`Delete ${e.category} note saved ${e.savedAt}`} onClick={() => change(() => deleteJourneyEntry(localStorage, e.id), 'Selected note deleted.')}>Delete note</button></li>)}</ol></section>)}
  </section>;
}
