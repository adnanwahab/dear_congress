import { useEffect, useState } from 'react';
import type { LegalClause, ProposalVersionData, PolicyPreview } from '../shared/policy-preview';
import { HOUSING_DEMO_TITLE, HOUSING_DEMO_TEXT } from '../shared/policy-preview';
import './policy-impact.css';
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Request failed.'); return result;
}
export function HousingDemoButton() {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <section className="cp-panel"><h2>See What Changes · housing demo</h2><p>Create a public synthetic proposal with two saved versions. This example connects smaller lots and parking reform to the h_lots mechanism. It is proposed text, not enacted law.</p><button className="cp-button" disabled={busy} onClick={async () => {
    setBusy(true); setError(''); try {
      let key = sessionStorage.getItem('housing-demo-key'); if (!key) { key = crypto.randomUUID(); sessionStorage.setItem('housing-demo-key', key); }
      const result = await api<{ proposal: { id: string } }>('/api/citizen-proposals/demo-housing', { confirmedPublic: true, idempotencyKey: key });
      window.location.href = `/proposals/${encodeURIComponent(result.proposal.id)}/versions/2/impact?base=1`;
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }}>{busy ? 'Creating…' : 'Create public synthetic housing demo'}</button>{error && <p role="alert">{error}</p>}</section>;
}
export function PolicyImpact({ id, selectedVersion, impact = false }: { id: string; selectedVersion?: number; impact?: boolean }) {
  const endpoint = `/api/citizen-proposals/${encodeURIComponent(id)}`;
  const fixture = id === 'demo-housing-fixture';
  const readEndpoint = fixture ? '/api/policy-preview-fixture' : endpoint + '/versions';
  const [data, setData] = useState<ProposalVersionData>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [base, setBase] = useState(Number(new URLSearchParams(window.location.search).get('base')) || 1);
  const [title, setTitle] = useState(''), [type, setType] = useState<'bill' | 'constitutional-amendment'>('bill');
  const [clauses, setClauses] = useState<LegalClause[]>([]), [publish, setPublish] = useState(false), [consent, setConsent] = useState(false);
  const [writeKey, setWriteKey] = useState(crypto.randomUUID());
  const [expectedVersion, setExpectedVersion] = useState<number>();
  const load = async () => { const result = await api<ProposalVersionData>(readEndpoint); if (!Array.isArray(result.versions) || !Array.isArray(result.previews)) throw new Error('Saved versions could not be loaded.'); setData(result); return result; };
  useEffect(() => { let active = true; api<ProposalVersionData>(readEndpoint).then(result => {
    if (!active) return; if (!Array.isArray(result.versions) || !Array.isArray(result.previews)) throw new Error('Saved versions could not be loaded.'); setData(result);
    const v = result.versions.find(v => v.version === selectedVersion) ?? result.versions.at(-1)!;
    setTitle(v.title); setType(v.type); setClauses(v.clauses); setExpectedVersion(result.versions.at(-1)!.version);
  }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [endpoint, selectedVersion]);
  const version = data?.versions.find(v => v.version === selectedVersion) ?? data?.versions.at(-1);
  const baseline = data?.versions.find(v => v.version === base);
  const preview = data?.previews.find(p => p.payload.source.versionId === version?.versionId && p.payload.baseline.versionId === baseline?.versionId);
  useEffect(() => {
    if (!preview || !['queued','running'].includes(preview.status)) return;
    // Reads never start remote work; only the consenting author's POST refreshes it.
    const timer = setInterval(() => { void load().catch(() => {}); }, 2500);
    return () => clearInterval(timer);
  }, [preview?.id, preview?.status]);
  useEffect(() => {
    if (!preview?.remoteId || !['queued', 'running'].includes(preview.status) || !data?.canEdit || !consent) return;
    const timer = setInterval(() => { void api(endpoint + `/versions/${version!.version}/impact`, { baseVersion: base, confirmedPublicTransfer: true }).catch(() => {}); }, 10000);
    return () => clearInterval(timer);
  }, [preview?.remoteId, preview?.status, data?.canEdit, consent, base]);
  if (!data || !version) return <section className="cp-panel"><h2>See What Changes</h2><p role={error ? 'alert' : 'status'}>{error || 'Loading saved versions…'}</p></section>;
  if (selectedVersion && !data.versions.some(v => v.version === selectedVersion)) return <p role="alert">Saved version not found.</p>;
  const path = `/proposals/${encodeURIComponent(id)}`;
  const ids = [...new Set([...(baseline?.clauses ?? []).map(c => c.clauseId), ...version.clauses.map(c => c.clauseId)])];
  const updateClause = (index: number, text: string) => { setClauses(cs => cs.map((c,i) => i === index ? { ...c, text } : c)); setWriteKey(crypto.randomUUID()); };
  const submit = async (action: () => Promise<unknown>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <section className="cp-panel pi" aria-label="See What Changes">
    {fixture && <p role="note"><strong>LOCAL DEVELOPMENT FIXTURE · not an HBL preview or prediction</strong></p>}
    <p className="cp-eyebrow">{data.provenance === 'synthetic' ? 'PUBLIC SYNTHETIC EXAMPLE' : 'PUBLIC CITIZEN PROPOSAL'} · VERSION {version.version}</p>
    <h1>{impact ? 'See What Changes' : 'Legal versions and impact previews'}</h1><h2>{version.title}</h2>
    <p role="note"><strong>Proposed {version.type === 'bill' ? 'bill' : 'constitutional amendment'} · unreviewed · not adopted.</strong> Simulations are modeled scenarios, not verified observations. Advisory responses do not approve legal text. Each version has separate advisory responses; revisions require a new response and do not inherit votes.</p>
    <nav aria-label="Revision history"><h3>Revision history</h3>{data.versions.map(v => <p key={v.version}><a href={`${path}/versions/${v.version}`}>Version {v.version}</a> · <time>{v.createdAt}</time> · <a href={`${path}/versions/${v.version}/impact?base=${v.version === 1 ? (data.versions[1]?.version ?? 1) : v.version - 1}`}>See What Changes</a></p>)}</nav>
    <p><a href={path}>Original proposal, advisory responses and public discussion</a> · <a href="#legal-editor">Revise and compare</a></p>
    <label>Compare with saved proposed version <select value={base} onChange={e => { setBase(Number(e.target.value)); setConsent(false); const url = new URL(window.location.href); url.searchParams.set('base', e.target.value); window.history.replaceState(null, '', url); }}>{data.versions.map(v => <option key={v.version} value={v.version}>{v.version} · {v.title}</option>)}</select></label>
    <h2>A. Legal changes</h2><p>Exact clause text against proposed version {base}. This baseline is not verified current law.</p>
    {base === version.version && <p>Save a revision or select a different version to see a diff.</p>}
    {ids.map(clauseId => {
      const before = baseline?.clauses.find(c => c.clauseId === clauseId)?.text ?? '', after = version.clauses.find(c => c.clauseId === clauseId)?.text ?? '';
      return <article key={clauseId} id={`clause-${clauseId}`}><h3>{clauseId} · {before === after ? 'Unchanged' : !before ? 'Added' : !after ? 'Removed' : 'Amended'}</h3><div className="pi-diff"><div><b>− Baseline</b><pre>{before && before !== after ? <del>{before}</del> : before || '(absent)'}</pre></div><div><b>+ Proposed</b><pre>{after && before !== after ? <ins>{after}</ins> : after || '(absent)'}</pre></div></div></article>;
    })}
    <details><summary>Reproducibility metadata</summary><p>Version: {version.versionId}</p><p>SHA-256: {version.contentHash}</p><p>Seed 42 · 100 paired runs · 24 months supported by HBL (requested default: 120 months). HBL currently limits the horizon to 24 months.</p>{preview && <pre>{JSON.stringify(preview.payload, null, 2)}</pre>}</details>
    <h2>B. Model changes</h2>
    <p>{version.title === HOUSING_DEMO_TITLE && data.provenance === 'synthetic' && baseline?.clauses[0]?.text === HOUSING_DEMO_TEXT[0] && version.clauses[1]?.text === HOUSING_DEMO_TEXT[1] && version.type === 'bill' ? 'Explicit synthetic catalog connection: section-1 → h_lots (reduce minimum lot sizes and parking mandates). This is a mechanism reference; HBL validates its reviewed mappings and parameters. No numerical effect is inferred here.' : 'No supported outcome model has been reviewed for this text. Arbitrary language and constitutional changes do not automatically produce validated effects.'}</p>
    {preview?.remoteMetadata && <details open><summary>HBL reviewed parameter changes and pinned model versions</summary><pre>{JSON.stringify(preview.remoteMetadata, null, 2)}</pre></details>}
    <h2>C. Interactive simulation</h2>
    <p role="status">{preview ? `${preview.status}: ${preview.message ?? 'HBL preview linked to this immutable version.'}` : 'No preview requested for this comparison.'}</p>
    {data.canEdit && base !== version.version && <div><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I reviewed the legal text and title above. They are public and contain no personal information or precise locations. Send only this legal diff and version metadata to HappyBearLandia.</label><p><button className="cp-button" disabled={!consent || busy} onClick={() => void submit(async () => { await api<{ preview: PolicyPreview }>(endpoint + `/versions/${version.version}/impact`, { baseVersion: base, confirmedPublicTransfer: true }); await load(); })}>{busy ? 'Saving request…' : ['unavailable', 'failed'].includes(preview?.status ?? '') ? 'Retry simulator' : 'See What Changes'}</button></p></div>}
    {preview?.results && <details><summary>{fixture ? "Local fixture timeline (illustrative only)" : "Recorded HBL result sample (paired run 0)"}</summary><p>Received {preview.results.receivedAt}. Model output; not verified real-world observations. Full results, parameters and explanation graph are available in HBL.</p><pre>{JSON.stringify(preview.results.data, null, 2)}</pre></details>}
    {preview?.url && <><p><a href={preview.url} target="_blank" rel="noopener noreferrer">Open full simulator</a></p><iframe title="Policy Impact Explorer: synchronized baseline and proposal" src={preview.url} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" loading="lazy" /></>}
    <h2>D. Time machine</h2><p>Use the HBL viewer’s baseline/proposal comparison and time scrubber to inspect its recorded timeline. No timeline results are invented locally.</p>
    <h2>E. Why Did This Happen?</h2><p><a href="#clause-section-1">Inspect legal clause section-1</a>. {preview?.url ? <a href={preview.url} target="_blank" rel="noopener noreferrer">Inspect the recorded model assumptions, parameters, explanation graph and outcomes in HBL</a> : 'A recorded explanation graph is available only after HBL accepts and models the preview.'}</p>
    <p>Discuss modeled assumptions and disputed mechanisms in the <a href={`${path}#cp-discussion-title`}>existing public discussion</a>. Include the version and clause ID; simulation output is not evidence of actual policy impact.</p>
    {!fixture && <section><h2>Advisory response · version {version.version}</h2><p>Anonymous browser responses, not verified people or legal approval. Respond again deliberately to a substantive revision.</p>{(['support','oppose','unsure'] as const).map(choice => <button key={choice} disabled={busy} aria-pressed={data.responses?.[String(version.version)]?.ownVote === choice} onClick={() => void submit(async () => { await api(endpoint + '/vote', { proposalVersion: version.version, choice }); await load(); })}>{choice} ({data.responses?.[String(version.version)]?.counts[choice] ?? 0})</button>)}<button disabled={busy} onClick={() => void submit(async () => { await api(endpoint + '/vote', {proposalVersion:version.version,choice:null}); await load(); })}>Remove this version’s response</button></section>}
    <h2 id="legal-editor">F. Revise and compare</h2>
    {data.canEdit ? <form onSubmit={e => { e.preventDefault(); void submit(async () => {
      const result = await api<{ version: { version: number }; impactUrl: string }>(endpoint + '/versions', { expectedVersion, title, type, clauses, confirmedPublic: publish, idempotencyKey: writeKey });
      window.location.href = result.impactUrl + `?base=${version.version}`;
    }); }}><fieldset disabled={busy}><label>Title<input required maxLength={160} value={title} onChange={e => { setTitle(e.target.value); setWriteKey(crypto.randomUUID()); }} /></label><label>Proposed document type<select value={type} onChange={e => { setType(e.target.value as typeof type); setWriteKey(crypto.randomUUID()); }}><option value="bill">Bill</option><option value="constitutional-amendment">Draft constitutional amendment (not adopted)</option></select></label>{clauses.map((c,i) => <div key={c.clauseId}><label>Clause {c.clauseId}<textarea aria-label={`Clause ${c.clauseId}`} required maxLength={10000} rows={5} value={c.text} onChange={e => updateClause(i,e.target.value)} /></label><button type="button" onClick={() => { setClauses(cs => cs.filter((_,n) => n !== i)); setWriteKey(crypto.randomUUID()); }}>Remove clause {c.clauseId}</button></div>)}<button type="button" onClick={() => { setClauses(cs => [...cs, { clauseId: `clause-${crypto.randomUUID()}`, text: '' }]); setWriteKey(crypto.randomUUID()); }}>Add clause</button><p><label><input type="checkbox" required checked={publish} onChange={e => setPublish(e.target.checked)} /> Publish this as a new immutable public version. I removed personal details. Existing votes stay bound to original text.</label></p><button className="cp-button" disabled={!publish || busy}>Save new version</button></fieldset></form> : <p>Only the original publishing browser can edit and request a transfer. Public saved previews remain shareable.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
