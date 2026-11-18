import { useEffect, useId, useRef, useState } from 'react';
import { counts, keyOf, verifySnapshot, type Choice, type RevisionKey, type Round, type Snapshot, type Source, type Submission, type WorkbenchAdapter } from './contract';
import './workbench.css';

export function RoundSummary({ round }: { round: Round | null }) {
  if (!round) return <p>No voting window published. No responses are inferred.</p>;
  const n = counts(round);
  if (!n) return <p role="alert">Response counts unavailable.</p>;
  return <div><p>Window {round.id}: {round.opensAt} to {round.closesAt} · {round.state}</p>
    <p>Electorate: {round.electorate}. Advisory responses; turnout and consensus are not established.</p>
    <p>{n.total === 0 ? 'No responses' : `${round.support} support · ${round.oppose} oppose · ${round.unsure} unsure`}</p>
    <p>Participation denominator: {n.total}. Decisive denominator: {n.decisive}.
      {' '}Support / all responses: {n.total ? `${round.support}/${n.total}` : 'undefined'}.
      {' '}Support / decisive responses: {n.decisive ? `${round.support}/${n.decisive}` : 'undefined'}.</p>
  </div>;
}
function Attribution({ source }: { source: Source }) {
  return <div><p>Revision: {source.revision} · Text SHA-256: {source.textHash}</p><p>Attribution: {source.attribution || 'Unassigned'}</p>
    <p>Provenance: {source.provenance || 'Unavailable'}</p><p>Human editorial status: {source.editorialStatus || 'Unreviewed'}</p></div>;
}
export function TextRedline({ before, after }: { before: string; after: string }) {
  // Complete replacement redline is intentional: no heuristic alignment can omit text.
  return before === after ? <p>No textual change.</p> : <div><p>Removed text</p><pre><del>{before}</del></pre><p>Added text</p><pre><ins>{after}</ins></pre></div>;
}
export function HeliosWorkbench({ selection, adapter }: { selection: RevisionKey; adapter: WorkbenchAdapter }) {
  // Keying the inner component prevents drafts, consent, receipts and choices crossing revisions.
  return <Session key={keyOf(selection)} selection={selection} adapter={adapter} />;
}
function Session({ selection, adapter }: { selection: RevisionKey; adapter: WorkbenchAdapter }) {
  const id = useId();
  const [data, setData] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [voteConsent, setVoteConsent] = useState(false);
  const [target, setTarget] = useState('');
  const [choice, setChoice] = useState<Choice | ''>('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const status = useRef<HTMLParagraphElement>(null);
  const active = useRef(true);
  const generation = useRef(0);
  const pending = useRef<Submission | null>(null);
  useEffect(() => {
    const controller = new AbortController(); active.current = true; generation.current += 1;
    setData(null); setFailed(false);
    adapter.load(selection, controller.signal).then(value => verifySnapshot(selection, value)).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { active.current = false; controller.abort(); };
  }, [adapter, reload]);
  async function save(value: Submission) {
    if (busy) return;
    // Retain identical retry IDs after uncertain network failures.
    const comparable = (v: Submission) => JSON.stringify({ ...v, requestId: '' });
    if (!pending.current || comparable(pending.current) !== comparable(value)) pending.current = value;
    const epoch = generation.current;
    setBusy(true); setMessage('Saving…');
    try {
      const result = await adapter.submit(pending.current);
      if (!result.receipt) throw new Error('missing receipt');
      if (!active.current || epoch !== generation.current) return;
      pending.current = null; setMessage(`Saved. Receipt: ${result.receipt}`);
      setText(''); setConsent(false); setVoteConsent(false); setChoice(''); setReload(n => n+1);
    } catch { if (active.current && epoch === generation.current) setMessage('Could not confirm save. Your input is retained. Retry to confirm.'); }
    finally { if (active.current && epoch === generation.current) { setBusy(false); status.current?.focus(); } }
  }
  const options = data ? [{ id: 'no-change', source: data.source, round: data.round }, ...data.amendments.map(a => ({ id: a.id, source: a, round: a.round }))] : [];
  const selected = options.find(o => o.id === target);
  return <section className="helios-workbench" aria-label="Revision-bound consensus workbench">
    <h2>{selection.billId} revision workbench</h2><p>Optional participation. AI suggestions are contestable drafts requiring human review. No automatic legal, merge or publication action.</p>
    <p ref={status} tabIndex={-1} role="status" aria-live="polite">{message}</p>
    {failed ? <div role="alert"><p>Source unavailable or revision/hash mismatch. Review and submission are blocked. Refresh the selected source.</p><button onClick={() => setReload(n => n+1)}>Retry source</button></div> : !data ? <p role="status">Verifying full source…</p> : <>
      <h3>Full selected source</h3><Attribution source={data.source} /><pre>{data.source.text}</pre>
      <h3>Unresolved dissent</h3>
      {data.objections.filter(o => o.status === 'unresolved').length === 0 && <p>No public unresolved objections returned. This does not establish agreement.</p>}
      {data.objections.map(o => <article key={o.id}><h4>{o.status} objection</h4><p>{o.text}</p><p>Attribution: {o.attribution || 'Unassigned'}</p><p>Editorial response: {o.response || 'None recorded'}</p></article>)}
      <form onSubmit={e => { e.preventDefault(); if (consent && text.trim() && !busy) void save({ ...selection, action: 'objection', text: text.trim(), consentPublic: true, requestId: crypto.randomUUID() }); }}>
        <h3>Optional public objection</h3><label htmlFor={`${id}-text`}>Objection text</label><textarea id={`${id}-text`} maxLength={4000} value={text} onChange={e => setText(e.target.value)} />
        <p>Submit only text you intend to make public. Private drafts, journals and identity details are not attached.</p>
        <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I consent to publishing this objection for this exact revision.</label>
        <button disabled={!consent || !text.trim() || busy}>Publish objection</button>
      </form>
      <h3>Compare alternatives</h3><p>No option is recommended or selected automatically. Each version retains its own window and denominator. Old votes never transfer.</p>
      {options.map(o => <article key={o.id}><h4>{o.id === 'no-change' ? 'No change — selected source' : 'AI-generated amendment'}</h4>
        <Attribution source={o.source} />{'rationale' in o.source && <p>Rationale: {String(o.source.rationale)}</p>}
        <TextRedline before={data.source.text} after={o.source.text} /><RoundSummary round={o.round} />
      </article>)}
      <form onSubmit={e => { e.preventDefault(); if (selected?.round?.state === 'open' && choice && voteConsent && !busy) void save({ ...selection, revision: selected.source.revision, action: 'vote', roundId: selected.round.id, choice, consent: true, requestId: crypto.randomUUID() }); }}>
        <label>Version to respond to<select value={target} onChange={e => { setTarget(e.target.value); setChoice(''); setVoteConsent(false); }}><option value="">Choose a version</option>{options.map(o => <option key={o.id} value={o.id}>{o.id === 'no-change' ? 'No change' : `AI amendment ${o.id}`} · {o.source.revision}</option>)}</select></label>
        <label>Advisory response<select value={choice} onChange={e => setChoice(e.target.value as Choice | '')}><option value="">Choose a response</option><option value="support">Support</option><option value="oppose">Oppose</option><option value="unsure">Unsure</option></select></label>
        <label><input type="checkbox" checked={voteConsent} onChange={e => setVoteConsent(e.target.checked)} />I reviewed this version and consent to a fresh advisory response.</label>
        <button disabled={busy || !voteConsent || !choice || selected?.round?.state !== 'open'}>Save response</button>
        <p>The server enforces the exact voting window and review gate. Unpublished alternatives cannot receive votes.</p>
      </form>
    </>}
  </section>;
}
