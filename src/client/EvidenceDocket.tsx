import { useState } from 'react';
import { docketText, EVIDENCE_CASES, prepareChallenge, type EvidenceChallenge } from '../shared/evidence-docket';
import './evidence-docket.css';

export function EvidenceDocket() {
  const [selected, setSelected] = useState(EVIDENCE_CASES[0]!.id);
  const [draft, setDraft] = useState<EvidenceChallenge | null>(null);
  const [message, setMessage] = useState('');
  const [fallback, setFallback] = useState(false);
  const records = draft ? [...EVIDENCE_CASES, draft] : EVIDENCE_CASES;
  const text = docketText(records);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'evidence-docket.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setFallback(true); setMessage('Download unavailable. Copy the plain text below or use browser Print.'); }
  }
  return <section className="panel evidence-docket" id="evidence-docket" aria-labelledby="evidence-docket-title">
    <h2 id="evidence-docket-title">Evidence challenge and correction docket</h2>
    <p>Prototype examples, not live submissions or verified moderator decisions. Review history contains no submitter identity or private notes. Do not enter private details in evidence or corrections.</p>
    <p>Primary source means an original record; editorial inference is an interpretation; user claim is an unverified assertion; synthetic estimate is invented model data. None alone establishes causality.</p>
    <p>Examples load with this page and remain readable offline after loading. External sources may be unavailable. Drafts stay in page memory and are lost on reload. No live moderation or appeal service is connected.</p>
    {EVIDENCE_CASES.map(record => <article className="card" key={record.id}>
      <h3>{record.id} · {record.status}</h3>
      <p><strong>{record.claim.kind}</strong> · {record.claim.text}</p>
      <dl><dt>Exact claim / revision</dt><dd>{record.claim.id} / {record.claim.revision}</dd>
        <dt>Source / locator</dt><dd>{record.claim.source ?? 'Missing source'} · {record.claim.locator}</dd>
        <dt>As of / limitations</dt><dd>{record.claim.date} · {record.claim.limitations}</dd>
        <dt>New evidence</dt><dd>{record.evidence}</dd><dt>Requested correction</dt><dd>{record.correction}</dd></dl>
      <ol>{record.history.map((event, i) => <li key={i}>{event.date}: {event.decision}. {event.rationale} Revision: {event.revision}. Human review: {event.humanReview}.</li>)}</ol>
      <p>Appeal: {record.appeal}</p>
    </article>)}
    <form onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        setDraft(prepareChallenge(EVIDENCE_CASES.find(r => r.id === selected)!.claim, String(form.get('evidence') ?? ''), String(form.get('correction') ?? '')));
        setMessage('Local draft prepared; awaiting human review. Nothing was submitted or changed. Export it before leaving.');
      } catch (error) { setMessage((error as Error).message); }
    }}>
      <h3>Prepare a challenge draft</h3>
      <label>Exact claim and source <select value={selected} onChange={e => { setSelected(e.target.value); setDraft(null); setMessage(''); }}>{EVIDENCE_CASES.map(r => <option key={r.id} value={r.id}>{r.claim.id} @ {r.claim.revision} — {r.claim.source ?? 'Missing source'}</option>)}</select></label>
      <label>New evidence, exact source/version, dates and limitations <textarea name="evidence" required maxLength={4000} /></label>
      <label>Requested correction <textarea name="correction" required maxLength={4000} /></label>
      <button type="submit">Prepare local draft</button>
    </form>
    <p role="status">{message}</p>
    {draft && <article className="card"><h3>Local draft · {draft.status}</h3><p>{draft.claim.id} @ {draft.claim.revision}</p><p>{draft.evidence}</p><p>Requested correction: {draft.correction}</p><p>{draft.appeal}</p></article>}
    <button type="button" onClick={download}>Download public docket text</button>{' '}
    <button type="button" onClick={() => setFallback(v => !v)}>Show copy / print text</button>
    {fallback && <label>Public docket text<textarea readOnly value={text} rows={18} /></label>}
    <pre className="docket-print">{text}</pre>
  </section>;
}
