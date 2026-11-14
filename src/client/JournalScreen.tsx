import { CivicHeader } from "./CivicHeader";
import { useJournalLive } from "./JournalLive";
import { useEffect, useState, useRef } from 'react';
import type { JournalEntry } from '../engine/types';
import VisionBoard from './VisionBoard';
import { SharedJournalFeed } from './SharedJournalFeed';
import JournalSharing from './JournalSharing';
import { needUrl } from './journal-motion';

type Request = <T>(path: string, body?: unknown, method?: string) => Promise<T>;
type Schema = { version: number; needs: { id: string; label: string }[] };
export default function JournalScreen({ request }: { request: Request }) {
  const { snapshot } = useJournalLive();
  const [search, setSearch] = useState(location.search);
  const query = new URLSearchParams(search);
  const targetId = query.get('entry');
  const generation = useRef(0);
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') === 'api' || location.pathname === '/api-docs' ? 'api' : 'write');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [error, setError] = useState('');
  const [published, setPublished] = useState<JournalEntry | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('JavaScript');
  async function load() {
    const version = ++generation.current;
    setLoading(true); setError(''); setEntries([]); setNextCursor(null);
    const params = new URLSearchParams(search);
    params.set('discovery', '1'); params.set('limit', '12');
    try {
      const data = await request<{ entries: JournalEntry[]; nextCursor: string | null }>(`/api/entries?${params}`);
      if (version === generation.current) { setEntries(data.entries); setNextCursor(data.nextCursor); }
    } catch {
      if (version === generation.current) { setEntries([]); setNextCursor(null); setError('Shared experiences are unavailable. Check your connection and retry.'); }
    } finally { if (version === generation.current) setLoading(false); }
  }
  useEffect(() => { const restore = () => { setSearch(location.search); setTab(new URLSearchParams(location.search).get('tab') === 'api' ? 'api' : 'write'); }; window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore); }, []);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [search]);
  useEffect(() => { request<Schema>('/api/journal-client/schema').then(setSchema).catch(() => setError('Need categories are unavailable. Retry or browse by origin and date.')); }, []);
  function navigate(params: URLSearchParams) { window.history.pushState(null, '', `/journal?${params}`); setSearch(location.search); }
  function changeTab(value: string) { setTab(value); const params = new URLSearchParams(search); params.set('tab', value); navigate(params); }
  const publicEntries = snapshot ? entries.filter(e => snapshot.entries.some(live => live.id === e.id)) : entries;
  const shownEntries = publicEntries;
  const controls = <form onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const params = new URLSearchParams();
    for (const [key, value] of data) if (String(value)) params.set(key, String(value));
    navigate(params);
  }} key={search} aria-label="Browse public experiences">
    <label>Origin <select name="origin" defaultValue={query.get('origin') ?? 'public'}><option value="public">Public submissions</option><option value="sample">Samples</option><option value="simulated">Simulated</option></select></label>
    <label>Need or topic <select name="need" defaultValue={query.get('need') ?? ''}><option value="">All needs</option>{schema?.needs.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
    <label>From (UTC) <input type="date" name="from" defaultValue={query.get('from') ?? ''} /></label>
    <label>Through (UTC) <input type="date" name="to" defaultValue={query.get('to') ?? ''} /></label>
    <label>Jurisdiction <select disabled aria-describedby="journal-location-note"><option>Not shared</option></select></label>
    <p id="journal-location-note">Consented public jurisdictions are not available. Location is never inferred.</p>
    <p>Sorted by most recent. Public submissions exclude flagged samples and simulations; authors are not verified.</p>
    <button type="submit">Apply filters</button> <a href="/journal">Clear filters</a>
  </form>;
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
  return <div className="civic-shell journal-shell"><CivicHeader stage="Journal & API" /><main id="main-content" tabIndex={-1} className="civic-main journal-main">
    <section className="journal-heading"><p className="map-eyebrow">Start with lived experience</p><h1>A journal that connects to change.</h1><a href="/proposals/new?guided=1">Propose a change · private guided draft</a><p>Share what is happening, discover the needs behind it, or connect your own journal app through the API.</p></section>
    {tab === 'write' && <VisionBoard />}
    <div className="journal-tabs" role="tablist" aria-label="Journal workspace"><button role="tab" id="journal-write-tab" aria-controls="journal-write" aria-selected={tab === 'write'} onClick={() => changeTab('write')}>Write & explore</button><button role="tab" id="journal-api-tab" aria-controls="journal-api" aria-selected={tab === 'api'} onClick={() => changeTab('api')}>Connect your app · API docs</button></div>
    {error && <div className="dashboard-alert" role="alert">{error} <button onClick={() => load()}>Retry loading</button></div>}
    <p className="dashboard-status" role="status">{copied}</p>
    {tab === 'write' ? <div id="journal-write" role="tabpanel" aria-labelledby="journal-write-tab" className="journal-grid"><section className="panel journal-compose"><div className="panel-head"><h2>What would make life better?</h2></div><p className="muted">A specific experience is a useful starting point. Describe the problem and the change you would like to see.</p><div className="journal-public-note">Entries appear in the shared demo feed. Use sample experiences and avoid private or identifying information.</div><JournalSharing request={request} needs={schema?.needs ?? []} onPublished={entry => { setPublished(entry); const params = new URLSearchParams(); params.set('entry', entry.id); navigate(params); }} /><div className="journal-publish"><button type="button" className="outline" onClick={() => changeTab('api')}>Connect via API</button></div>{published && <div className="journal-result"><h3>Published entry</h3>{!published.extraction.needs.length && <p>Published without need tags.</p>}<div className="sponsor-chips">{published.extraction.needs.map(n => <a key={n.id} href={needUrl(n.id, published.id)}>{schema?.needs.find(v => v.id === n.id)?.label ?? n.id} · See it in Needs →</a>)}</div><small>Entry ID: {published.id}</small><a className="dashboard-button" href="/synth">See the plan →</a></div>}</section><section className="panel">{controls}{targetId && <p>Linked public entry · <a href="/journal">Browse all public submissions</a></p>}<SharedJournalFeed publishedId={published?.id} entries={shownEntries} needs={schema?.needs ?? []} loading={loading} /><nav aria-label="Journal pagination">{query.has('cursor') && <button className="outline" onClick={() => { const params = new URLSearchParams(search); params.delete('cursor'); navigate(params); }}>First page</button>}{nextCursor && <button className="outline" disabled={loading} onClick={() => { const params = new URLSearchParams(search); params.set('cursor', nextCursor); navigate(params); }}>Next page</button>}</nav></section></div> :
    <div id="journal-api" role="tabpanel" aria-labelledby="journal-api-tab" className="api-layout"><aside className="panel api-toc"><h2>Journal API</h2><span className="pill info">Schema v{schema?.version ?? 2}</span><a href="#api-quickstart">Quick start</a><a href="#api-endpoints">Endpoints</a><a href="#api-fields">Request fields</a><a href="#api-response">Response & errors</a><a href="#api-live">Live updates</a><a href="/api/journal-client/schema" target="_blank" rel="noopener">Open live schema ↗</a><button className="outline" onClick={() => changeTab('write')}>← Back to journal</button></aside><div className="api-content"><section className="panel" id="api-quickstart"><div className="panel-head"><h2>Connect in one request</h2><span>JSON over HTTPS</span></div><p>Send an experience to the same endpoint used by this journal. Always specify <code>kind: "journal"</code> so your client does not depend on a server default.</p><div className="api-base"><span>BASE URL</span><code>{origin}</code><button className="outline" onClick={() => copy(origin,'Base URL copied.')}>Copy</button></div><div className="code-toolbar"><div>{['JavaScript','cURL'].map(l => <button key={l} className={codeLanguage === l ? '' : 'outline'} onClick={() => setCodeLanguage(l)}>{l}</button>)}</div><button className="outline" onClick={() => copy(codeLanguage === 'JavaScript' ? js : curl,'Example copied.')}>Copy example</button></div><pre className="api-code"><code>{codeLanguage === 'JavaScript' ? js : curl}</code></pre><p className="api-note">Retain the server-issued signed anonymous cookie. The x-voter-id header is ignored. This is browser ownership, not verified identity; journals are public. Cross-origin writes require a configured allowed origin.</p></section>
    <section className="panel" id="api-endpoints"><h2>Endpoints</h2><div className="api-table-wrap"><table className="api-table"><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead><tbody>{[['GET','/api/journal-client/schema','Discover supported kinds and current need IDs.'],['POST','/api/publish_draft','Publish publicly; inference: "none" skips extraction.'],['GET','/api/entries?limit=12','Read the shared feed. Follow nextCursor with &cursor=…'],['POST','/api/publish_labels','Disabled (403); select labels before publishing.'],['GET','/api/entries/events','Listen to the shared feed using server-sent events.']].map(([m,p,d]) => <tr key={p}><td><span className={`method ${m === 'POST' ? 'post' : ''}`}>{m}</span></td><td><code>{p}</code></td><td>{d}</td></tr>)}</tbody></table></div><p className="api-note">Cross-origin publishing and reads support CORS preflight. Public label correction is disabled (403). Choose categories before publishing.</p></section>
    <section className="panel" id="api-fields"><h2>Publishing a journal</h2><div className="api-table-wrap"><table className="api-table"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>{[['kind','string','Use "journal" explicitly.'],['inference','string · optional','Set "none" to skip all inference. Legacy omission still runs extraction; publication is public in either mode.'],['text','string · required','Your experience, up to 10,000 characters.'],['author','string · optional','Display name, up to 120 characters.'],['labels / needs','string[] · optional','Need IDs from the live schema. With inference: "none", omit or send [] to publish without tags.'],['synthetic','boolean · optional','true for simulated or generated journal experiences.'],['source','string · optional','Client/source label, up to 64 characters.'],['location','object · optional','{ lat, lng }; real locations are floored to 0.01° cells. Omit unless needed.']].map(([f,t,d]) => <tr key={f}><td><code>{f}</code></td><td>{t}</td><td>{d}</td></tr>)}</tbody></table></div><p className="api-note">The feed returns <code>entries</code>, <code>total</code>, and <code>nextCursor</code>. Set <code>limit</code> from 1 to 100 (default 50). The cursor is the last returned entry ID; a null cursor means you have reached the end.</p></section>
    <section className="panel" id="api-response"><h2>Response & errors</h2><p>A successful publish returns HTTP 200 with the entry and its categories. This is an illustrative response; generated IDs, timestamps, and extraction results vary.</p><pre className="api-code"><code>{responseExample}</code></pre><p>Invalid requests return HTTP 400 with <code>{'{ "error": "text is required" }'}</code>. Check <code>response.ok</code> before treating a publish as successful. Publishing has no idempotency key yet: an automatic retry after an uncertain network failure can create a duplicate.</p></section>
    <section className="panel" id="api-live"><h2>Listen for new experiences</h2><pre className="api-code"><code>{`const stream = new EventSource(${JSON.stringify(origin + '/api/entries/events')});\nstream.onmessage = event => {\n  const { entries } = JSON.parse(event.data);\n  renderSharedFeed(entries); // Replace with your UI update.\n};\n// Close when the screen unmounts:\n// stream.close();`}</code></pre><p>The stream sends an initial snapshot and later shared-feed snapshots. Browser EventSource reconnects automatically. This stream is public; it does not contain private per-user subscriptions.</p></section></div></div>}
  </main></div>;
}
