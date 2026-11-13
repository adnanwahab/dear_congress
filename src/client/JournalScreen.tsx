import { useJournalLive } from "./JournalLive";
import { useEffect, useState } from 'react';
import type { JournalEntry } from '../engine/types';
import VisionBoard from './VisionBoard';

type Request = <T>(path: string, body?: unknown, method?: string) => Promise<T>;
type Schema = { version: number; needs: { id: string; label: string }[] };
const SAMPLE = 'The bus to work is often late, and childcare costs are making it difficult to keep my shifts. More reliable transit and affordable care would help my family.';
export default function JournalScreen({ request }: { request: Request }) {
  const { snapshot } = useJournalLive();
  const targetId = new URLSearchParams(location.search).get('entry');
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') === 'api' || location.pathname === '/api-docs' ? 'api' : 'write');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [text, setText] = useState('');
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [publishConsent, setPublishConsent] = useState(false);
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [published, setPublished] = useState<JournalEntry | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('JavaScript');
  async function load(cursor?: string) {
    const data = await request<{ entries: JournalEntry[]; nextCursor: string | null }>(`/api/entries?limit=12${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    setEntries(previous => cursor ? [...previous, ...data.entries.filter(e => !previous.some(p => p.id === e.id))] : data.entries); setNextCursor(data.nextCursor);
  }
  useEffect(() => {
    Promise.all([load(), request<Schema>('/api/journal-client/schema').then(setSchema)]).catch(() => setError('Could not load the journal. Please try again.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    setEntries(previous => {
      const live = [...snapshot.entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const target = live.find(e => e.id === targetId);
      const page = live.slice(0, Math.max(12, previous.length));
      return target && !page.some(e => e.id === target.id) ? [target, ...page] : page;
    });
  }, [snapshot, targetId]);
  useEffect(() => {
    if (targetId && entries.some(e => e.id === targetId)) document.getElementById(`story-${targetId}`)?.scrollIntoView({ block: 'center' });
  }, [entries, targetId]);
  function changeTab(value: string) { setTab(value); const url = value === 'api' ? '/journal?tab=api' : '/journal'; window.history.replaceState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate')); }
  async function publish() {
    if (busy || !text.trim() || !publishConsent) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await request<{ ok: true; mode: 'journal'; entry: JournalEntry }>('/api/publish_draft', { kind: 'journal', inference: 'none', labels: selectedNeeds, text: text.trim(), author: author.trim() || 'Demo participant', synthetic: text.trim() === SAMPLE, source: text.trim() === SAMPLE ? 'civic-synthesis-demo' : undefined });
      setPublished(result.entry); setText(''); setSelectedNeeds([]); setPublishConsent(false); setStatus('Published publicly with only the categories you selected. No inference was requested and no vote was cast.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not publish. Your draft is still here.'); }
    finally { setBusy(false); }
  }
  const publicEntries = snapshot ? entries.filter(e => snapshot.entries.some(live => live.id === e.id)) : entries;
  const targetEntry = snapshot?.entries.find(e => e.id === targetId);
  const shownEntries = targetEntry && !publicEntries.some(e => e.id === targetId) ? [targetEntry, ...publicEntries] : publicEntries;
  const origin = window.location.origin;
  const exampleBody = { kind: 'journal', text: 'The bus to work is often late. Reliable transit would help.', author: 'Demo participant', synthetic: true, inference: 'none', labels: [] };
  const js = `const response = await fetch(${JSON.stringify(origin + '/api/publish_draft')}, {
  method: 'POST',
  credentials: 'include', // Retain the signed anonymous browser cookie.
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(exampleBody, null, 2)})
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || 'Publish failed');`;
  const curl = `curl -c cookies.txt -b cookies.txt '${origin}/api/publish_draft' -H 'Content-Type: application/json' --data '${JSON.stringify(exampleBody)}'`;
  const responseExample = JSON.stringify({ ok: true, mode: 'journal', entryId: 'generated-entry-id', acceptedNeedIds: [], ignoredNeedIds: [], entry: { id: 'generated-entry-id', author: 'Demo participant', text: exampleBody.text, createdAt: '2026-11-12T12:00:00.000Z', extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] }, corrected: true } }, null, 2);
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setCopied(label); } catch { setCopied('Copy unavailable. Select the code below to copy manually.'); } }
  return <div className="civic-shell journal-shell"><header className="civic-header"><div className="header-brand"><a href="/">Civic Synthesis</a><span className="pill">Journal & API</span></div><div className="header-meta"><span className="pill warn">PUBLIC DEMO</span><span className="pill info">Your words → shared needs</span></div></header><main className="civic-main journal-main">
    <section className="journal-heading"><p className="map-eyebrow">Start with lived experience</p><h1>A journal that connects to change.</h1><a href="/proposals/new?guided=1">Propose a change · private guided draft</a><p>Share what is happening, discover the needs behind it, or connect your own journal app through the API.</p></section>
    {tab === 'write' && <VisionBoard />}
    <div className="journal-tabs" role="tablist" aria-label="Journal workspace"><button role="tab" id="journal-write-tab" aria-controls="journal-write" aria-selected={tab === 'write'} onClick={() => changeTab('write')}>Write & explore</button><button role="tab" id="journal-api-tab" aria-controls="journal-api" aria-selected={tab === 'api'} onClick={() => changeTab('api')}>Connect your app · API docs</button></div>
    {error && <div className="dashboard-alert" role="alert">{error} <button onClick={() => load().then(() => setError('')).catch(() => setError('Could not reload. Please try again later.'))}>Retry loading</button></div>}
    <p className="dashboard-status" role="status">{status || copied}</p>
    {tab === 'write' ? <div id="journal-write" role="tabpanel" aria-labelledby="journal-write-tab" className="journal-grid"><section className="panel journal-compose"><div className="panel-head"><h2>What would make life better?</h2></div><p className="muted">A specific experience is a useful starting point. Describe the problem and the change you would like to see.</p><div className="journal-public-note">Entries appear in the shared demo feed. Use sample experiences and avoid private or identifying information.</div><form onSubmit={e => { e.preventDefault(); publish(); }}><label className="journal-label" htmlFor="journal-text">Your experience</label><textarea id="journal-text" rows={7} maxLength={10000} value={text} onChange={e => { setText(e.target.value); setPublishConsent(false); }} placeholder="The bus to work is often late, and childcare costs keep going up…" required /><div className="journal-form-meta"><button type="button" className="journal-text-button" onClick={() => { setText(SAMPLE); setPublishConsent(false); }}>Use a sample experience</button><span>{text.length.toLocaleString()} / 10,000</span></div><label className="journal-label" htmlFor="journal-author">Display name <span>(optional)</span></label><input id="journal-author" maxLength={120} value={author} onChange={e => setAuthor(e.target.value)} placeholder="Demo participant" /><fieldset disabled={busy}><legend>Choose needs yourself (optional)</legend><p>No AI or keyword inference is requested by this form. Leave every category unchecked to publish without tags. These choices do not cast votes.</p>{schema?.needs.map(n => <label key={n.id} style={{display: 'block'}}><input type="checkbox" checked={selectedNeeds.includes(n.id)} onChange={e => setSelectedNeeds(ids => e.target.checked ? [...ids, n.id] : ids.filter(id => id !== n.id))} /> {n.label}</label>)}</fieldset><p>Your unfinished entry stays only in this page’s memory. Leaving or reloading discards it.</p><label><input type="checkbox" checked={publishConsent} onChange={e => setPublishConsent(e.target.checked)} /> I want to publish this entry and selected categories publicly.</label><div className="journal-publish"><button disabled={busy || !text.trim() || !publishConsent}>{busy ? 'Publishing…' : 'Publish to shared journal'}</button><button type="button" className="outline" onClick={() => changeTab('api')}>Connect via API</button></div></form>{published && <div className="journal-result"><h3>Published entry</h3>{!published.extraction.needs.length && <p>Published without need tags.</p>}<div className="sponsor-chips">{published.extraction.needs.map(n => <a key={n.id} href="/needs">{schema?.needs.find(v => v.id === n.id)?.label ?? n.id} →</a>)}</div><small>Entry ID: {published.id}</small><a className="dashboard-button" href="/synth">See the plan →</a></div>}</section><section className="panel"><div className="panel-head"><h2>Shared journal</h2><span>{loading ? 'Loading…' : `${entries.length} loaded`}</span></div><p className="muted">Original experiences, with their attached need labels.</p><div className="journal-feed">{shownEntries.map(e => <article key={e.id} id={`story-${e.id}`} tabIndex={-1}><div className="journal-entry-meta"><strong>{e.author || 'Participant'}</strong><time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleDateString(undefined,{ month:'short',day:'numeric' })}</time></div><p>{e.text}</p><div className="journal-need-tags">{e.extraction.needs.map(n => <span key={n.id}>{schema?.needs.find(v => v.id === n.id)?.label ?? n.id}</span>)}{(e.synthetic || e.seeded) && <span className="sample-tag">Sample</span>}</div></article>)}{!loading && !entries.length && <p className="empty-feed">No experiences yet. Publish the first sample to begin.</p>}</div>{nextCursor && <button className="outline" disabled={busy} onClick={async () => { setBusy(true); try { await load(nextCursor); } catch { setError('Could not load more entries.'); } finally { setBusy(false); } }}>Load more entries</button>}</section></div> :
    <div id="journal-api" role="tabpanel" aria-labelledby="journal-api-tab" className="api-layout"><aside className="panel api-toc"><h2>Journal API</h2><span className="pill info">Schema v{schema?.version ?? 2}</span><a href="#api-quickstart">Quick start</a><a href="#api-endpoints">Endpoints</a><a href="#api-fields">Request fields</a><a href="#api-response">Response & errors</a><a href="#api-live">Live updates</a><a href="/api/journal-client/schema" target="_blank" rel="noopener">Open live schema ↗</a><button className="outline" onClick={() => changeTab('write')}>← Back to journal</button></aside><div className="api-content"><section className="panel" id="api-quickstart"><div className="panel-head"><h2>Connect in one request</h2><span>JSON over HTTPS</span></div><p>Send an experience to the same endpoint used by this journal. Always specify <code>kind: "journal"</code> so your client does not depend on a server default.</p><div className="api-base"><span>BASE URL</span><code>{origin}</code><button className="outline" onClick={() => copy(origin,'Base URL copied.')}>Copy</button></div><div className="code-toolbar"><div>{['JavaScript','cURL'].map(l => <button key={l} className={codeLanguage === l ? '' : 'outline'} onClick={() => setCodeLanguage(l)}>{l}</button>)}</div><button className="outline" onClick={() => copy(codeLanguage === 'JavaScript' ? js : curl,'Example copied.')}>Copy example</button></div><pre className="api-code"><code>{codeLanguage === 'JavaScript' ? js : curl}</code></pre><p className="api-note">Retain the server-issued signed anonymous cookie. The x-voter-id header is ignored. This is browser ownership, not verified identity; journals are public. Cross-origin writes require a configured allowed origin.</p></section>
    <section className="panel" id="api-endpoints"><h2>Endpoints</h2><div className="api-table-wrap"><table className="api-table"><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead><tbody>{[['GET','/api/journal-client/schema','Discover supported kinds and current need IDs.'],['POST','/api/publish_draft','Publish publicly; inference: "none" skips extraction.'],['GET','/api/entries?limit=12','Read the shared feed. Follow nextCursor with &cursor=…'],['POST','/api/publish_labels','Disabled (403); select labels before publishing.'],['GET','/api/entries/events','Listen to the shared feed using server-sent events.']].map(([m,p,d]) => <tr key={p}><td><span className={`method ${m === 'POST' ? 'post' : ''}`}>{m}</span></td><td><code>{p}</code></td><td>{d}</td></tr>)}</tbody></table></div><p className="api-note">Cross-origin publishing and reads support CORS preflight. Public label correction is disabled (403). Choose categories before publishing.</p></section>
    <section className="panel" id="api-fields"><h2>Publishing a journal</h2><div className="api-table-wrap"><table className="api-table"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>{[['kind','string','Use "journal" explicitly.'],['inference','string · optional','Set "none" to skip all inference. Legacy omission still runs extraction; publication is public in either mode.'],['text','string · required','Your experience, up to 10,000 characters.'],['author','string · optional','Display name, up to 120 characters.'],['labels / needs','string[] · optional','Need IDs from the live schema. With inference: "none", omit or send [] to publish without tags.'],['synthetic','boolean · optional','true for simulated or generated journal experiences.'],['source','string · optional','Client/source label, up to 64 characters.'],['location','object · optional','{ lat, lng }; real locations are floored to 0.01° cells. Omit unless needed.']].map(([f,t,d]) => <tr key={f}><td><code>{f}</code></td><td>{t}</td><td>{d}</td></tr>)}</tbody></table></div><p className="api-note">The feed returns <code>entries</code>, <code>total</code>, and <code>nextCursor</code>. Set <code>limit</code> from 1 to 100 (default 50). The cursor is the last returned entry ID; a null cursor means you have reached the end.</p></section>
    <section className="panel" id="api-response"><h2>Response & errors</h2><p>A successful publish returns HTTP 200 with the entry and its categories. This is an illustrative response; generated IDs, timestamps, and extraction results vary.</p><pre className="api-code"><code>{responseExample}</code></pre><p>Invalid requests return HTTP 400 with <code>{'{ "error": "text is required" }'}</code>. Check <code>response.ok</code> before treating a publish as successful. Publishing has no idempotency key yet: an automatic retry after an uncertain network failure can create a duplicate.</p></section>
    <section className="panel" id="api-live"><h2>Listen for new experiences</h2><pre className="api-code"><code>{`const stream = new EventSource(${JSON.stringify(origin + '/api/entries/events')});\nstream.onmessage = event => {\n  const { entries } = JSON.parse(event.data);\n  renderSharedFeed(entries); // Replace with your UI update.\n};\n// Close when the screen unmounts:\n// stream.close();`}</code></pre><p>The stream sends an initial snapshot and later shared-feed snapshots. Browser EventSource reconnects automatically. This stream is public; it does not contain private per-user subscriptions.</p></section></div></div>}
  </main></div>;
}
