import { useEffect, useId, useState } from 'react';
import type { AmendmentSource } from './amendment-drafts';
import { anchorLine, clauseRevision, orphaned, readMarginalia, reviewExcerpt, saveMarginalia, type ClauseNote } from './clause-marginalia';
const storage = { getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v) };
export default function ClauseMarginalia({ source }: { source: AmendmentSource }) {
  const id = useId();
  const [loaded, setLoaded] = useState<{ revision: string; notes: ClauseNote[]; signature: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [line, setLine] = useState(1);
  const [kind, setKind] = useState<'question' | 'proposal'>('question');
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [share, setShare] = useState<ClauseNote | null>(null);
  const signature = JSON.stringify(source);
  useEffect(() => {
    let active = true; setLoaded(null); setError(''); setShare(null);
    (async () => {
      try { const revision = await clauseRevision(source); const notes = await readMarginalia(storage, source); if (active) setLoaded({ revision, notes, signature }); }
      catch { if (active) setError('Could not load private notes. Existing storage is untouched. Retry to continue.'); }
    })();
    return () => { active = false; };
  }, [signature, attempt]);
  const ready = loaded?.signature === signature ? loaded : null;
  function commit(notes: ClauseNote[], message: string) {
    if (!ready) return;
    try { saveMarginalia(storage, source, notes); setLoaded({ ...ready, notes }); setNotice(message); setError(''); }
    catch { setError('Could not save private notes. Your text and earlier notes are retained.'); }
  }
  return <section className="amendment-editor" aria-label="Clause marginalia">
    <h2>Questions beside the source</h2>
    <p>{source.kind === 'sample' ? 'Fictional sample; not legal text.' : 'Citizen proposal; official legal status unverified.'} Origin: {source.origin} · {source.kind}:{source.id}</p>
    <p>Private notes stay in this browser on this device. Each anchor records an exact source revision and line, not an inferred legal clause. Citation notes are unverified. Nothing here casts a vote.</p>
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(a => a + 1)}>Retry private notes</button></p>}
    {!ready && !error && <p role="status">Loading source anchors and private notes…</p>}
    {ready && <>
      <p>Source revision: <code>{ready.revision}</code></p>
      {source.text.split('\n').map((quote, index) => <div className="clause-row" key={index}>
        <div id={`${id}-line-${index + 1}`}><strong>Line {index + 1}</strong><p className="amendment-text">{quote || '(blank line)'}</p></div>
        <aside aria-label={`Notes for line ${index + 1}`}>
          {quote.trim() && <button type="button" onClick={() => { setLine(index + 1); document.getElementById(`${id}-note`)?.focus(); }}>Annotate line {index + 1}</button>}
          {ready.notes.filter(n => !orphaned(n, ready.revision) && n.anchor.line === index + 1).map(renderNote)}
        </aside>
      </div>)}
      <form onSubmit={e => { e.preventDefault(); if (!text.trim()) return; const note: ClauseNote = { id: crypto.randomUUID(), kind, text, anchor: anchorLine(source, ready.revision, line), previousAnchors: [] }; commit([...ready.notes, note], 'Private note saved in this browser.'); }}>
        <label htmlFor={`${id}-line`}>Source line</label><select id={`${id}-line`} value={line} onChange={e => setLine(Number(e.target.value))}>{source.text.split('\n').map((q, i) => q.trim() && <option key={i} value={i + 1}>Line {i + 1}</option>)}</select>
        <label htmlFor={`${id}-kind`}>Note type</label><select id={`${id}-kind`} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="question">Question</option><option value="proposal">Proposal</option></select>
        <label htmlFor={`${id}-note`}>Private note / citation</label><textarea id={`${id}-note`} required maxLength={3000} value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" disabled={!source.text.split('\n')[line - 1]?.trim()}>Save private note</button>
      </form>
      <section aria-label="Orphaned anchors"><h3>Orphaned anchors — reattachment needed</h3><p>Changed text never moves a note automatically. Select a current line above, then explicitly reattach. Earlier anchors are preserved.</p>{ready.notes.filter(n => orphaned(n, ready.revision)).map(renderNote)}</section>
    </>}
    {share && <section aria-label="Review excerpt"><h3>Review before sharing</h3><p>This includes the selected note and its source snapshot. Copy it only to a recipient you choose. No review request has been sent.</p><label htmlFor={`${id}-share`}>Copyable review excerpt</label><textarea id={`${id}-share`} readOnly value={reviewExcerpt(share)} /><button type="button" onClick={() => setShare(null)}>Close review excerpt</button></section>}
    <p aria-live="polite">{notice}</p>
  </section>;
  function renderNote(n: ClauseNote) {
    return <article key={n.id}><strong>{n.kind} · Private</strong><p>{n.text}</p><details><summary>Exact source anchor</summary><p>{n.anchor.revisionId} · Line {n.anchor.line}</p><blockquote>{n.anchor.quote}</blockquote><p>Earlier anchors retained: {n.previousAnchors.length}</p></details>
      <button type="button" onClick={() => setShare(n)}>Share for review</button>
      <button type="button" onClick={() => setNotice('Abuse report not submitted. This private-note pilot has no reporting service. Do not include sensitive information in a public journal.')}>Report abuse</button>
      {ready && orphaned(n, ready.revision) && <button type="button" disabled={!source.text.split('\n')[line - 1]?.trim() || n.previousAnchors.length >= 100} onClick={() => commit(ready.notes.map(row => row.id === n.id ? { ...row, previousAnchors: [...row.previousAnchors, row.anchor], anchor: anchorLine(source, ready.revision, line) } : row), `Reattached to current line ${line}; earlier anchor retained.`)}>Reattach to selected line {line}</button>}
    </article>;
  }
}
