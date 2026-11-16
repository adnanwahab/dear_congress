import { useEffect, useState } from 'react';
import { stageRoute } from '../shared/civic-stages';
import './passport.css';

export const PASSPORT_KEY = 'civic-learning-passport-v1';
export const milestones = [
  { id: 'evidence', title: 'Evidence explorer', task: 'Open a background source in Published. Compare its publisher and scope with the fictional proposal. Notice what the source does not establish.', stage: 'published' },
  { id: 'jurisdiction', title: 'Jurisdiction explorer', task: 'Explore a proposal in Feed. Identify whether its scenario belongs to a city, county, state or federal institution and who could act on it.', stage: 'feed' },
  { id: 'perspectives', title: 'Perspective explorer', task: 'Open the transit sample in Feed and compare its supporting argument, concern and counterarguments. Consider what evidence might change either view. Agreement is not required.', stage: 'feed' },
] as const;
type Badge = typeof milestones[number]['id'];
export function decodePassport(raw: string | null): Badge[] | null {
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.badges) || !value.badges.every((id: unknown) => milestones.some(m => m.id === id)) || new Set(value.badges).size !== value.badges.length) throw Error('Invalid passport');
  return value.badges;
}

export function CivicPassport() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function load() {
    try { setBadges(decodePassport(localStorage.getItem(PASSPORT_KEY))); setError(''); }
    catch { setError('Passport storage is unavailable or invalid. Saved data has not been replaced. Retry, export the saved data, or delete it.'); }
    setLoading(false);
  }
  useEffect(() => { load(); const sync = (event: StorageEvent) => { if (event.key === PASSPORT_KEY || event.key === null) load(); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  function save(next: Badge[], message: string) {
    try { localStorage.setItem(PASSPORT_KEY, JSON.stringify({ version: 1, badges: next })); setBadges(next); setError(''); setNotice(message); }
    catch { setError('Could not save passport. Progress has not changed. Retry when browser storage is available.'); }
  }
  function award(id: Badge) {
    try { const current = decodePassport(localStorage.getItem(PASSPORT_KEY)); if (current === null) throw Error(); save([...new Set([...current, id])], 'Learning badge saved privately in this browser.'); }
    catch { setError('Could not read the active passport. Retry loading before recording progress.'); }
  }
  function download() {
    try {
      const raw = localStorage.getItem(PASSPORT_KEY);
      const url = URL.createObjectURL(new Blob([raw ?? JSON.stringify({ version: 1, badges: [] })], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'private-civic-passport.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Passport export prepared. The file contains local learning progress only.');
    } catch { setError('Could not export passport. Saved data has not changed.'); }
  }
  return <section className="panel civic-passport" aria-labelledby="passport-title" aria-busy={loading}>
    <p className="workflow-eyebrow">Demo / sandbox · awaiting review</p>
    <h2 id="passport-title">Your private civic passport</h2>
    <p>Optional, self-reported learning badges. Private to this browser profile, independent of verified identity. Other people using this profile can read it. No account, identity, vote choice or browsing history is stored in the passport or sent to a server. Exported files are yours to keep private.</p>
    <p>No points or badges for Support/Oppose, public posts, popularity or influence. Badges confer no voting power or verified civic status. Fictional examples, model projections and real votes stay separate.</p>
    {loading ? <p role="status">Loading local passport…</p> : <>
      {error && <><p role="alert">{error}</p><button type="button" onClick={load}>Retry loading passport</button></>}
      {!error && badges === null && <><p>Passport is off. Nothing is recorded until you start.</p><button type="button" onClick={() => save([], 'Passport started. Choose any learning step; there is no deadline.')}>Start optional passport</button></>}
      {!error && badges !== null && <><p role="status">{badges.length} of {milestones.length} learning badges · explore in any order</p>
        <ol>{milestones.map(m => <li key={m.id}><h3>{m.title} · {badges.includes(m.id) ? 'Earned' : 'Not recorded'}</h3><p>{m.task}</p><a href={stageRoute(m.stage, m.id === 'perspectives' ? 'demo-transit' : undefined)}>Explore {m.title.toLowerCase()}</a><p><button type="button" disabled={badges.includes(m.id)} onClick={() => award(m.id)}>{badges.includes(m.id) ? 'Badge earned' : `I explored this · earn ${m.title}`}</button></p></li>)}</ol>
        <button type="button" onClick={() => save([], 'Progress reset. Passport remains enabled.')}>Reset learning progress</button>
      </>}
      {(badges !== null || error) && <div className="passport-actions"><button type="button" onClick={download}>Export passport</button><button type="button" onClick={() => { try { localStorage.removeItem(PASSPORT_KEY); setBadges(null); setError(''); setNotice('Passport deleted and turned off. Previously exported files are unchanged.'); } catch { setError('Could not delete passport. Retry when browser storage is available.'); } }}>Delete passport and turn off</button></div>}
      <p role="status">{notice}</p>
    </>}
  </section>;
}
