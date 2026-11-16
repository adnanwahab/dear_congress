import { useId, useState } from 'react';
import { SAMPLE_EXPERT, updateQueue, type OfficeHoursSource, type QueueAction, type OfficeQueue } from './office-hours';
import './office-hours.css';

export function OfficeHours({ source }: { source: OfficeHoursSource }) {
  const id = useId();
  const [queue, setQueue] = useState<OfficeQueue>({ source: { ...source }, questions: [] });
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  function apply(action: QueueAction) {
    try { setQueue(updateQueue(queue, source, action, SAMPLE_EXPERT)); setError(''); setStatus('Rehearsal updated in page memory. Nothing published.'); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update the rehearsal. Your text is still here.'); setStatus(''); return false; }
  }
  return <section className="panel office-hours" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Expert office hours · local rehearsal</h2>
    <p><strong>Simulated session. No real expert verified or contacted.</strong> Questions and answers stay in page memory and disappear when you leave, reload, change proposals or change the draft revision. Do not enter private information.</p>
    <p>Context: {source.repository} · {source.kind}:{source.id}. Bound to the displayed draft text.</p>
    <p><strong>Verification: simulated verified · no real credential checked.</strong></p><p>Conflicts: {SAMPLE_EXPERT.conflicts}</p>
    <details><summary>Expert verification details · simulated</summary>
      <p>{SAMPLE_EXPERT.name} · Verification: simulated verified</p><p>Scope: {SAMPLE_EXPERT.scope}</p>
      <p>Checked by: {SAMPLE_EXPERT.checkedBy} · <time dateTime={SAMPLE_EXPERT.checkedAt}>{SAMPLE_EXPERT.checkedAt}</time></p>
      <p>Basis: {SAMPLE_EXPERT.basis}</p>
    </details>
    <p><strong>Expert opinion is separate from source evidence and official decisions.</strong> Credentials do not establish that an answer is correct. Citation notes are unverified. No official decision is made here; existing votes and draft text stay unchanged.</p>
    <form onSubmit={e => { e.preventDefault(); if (apply({ type: 'ask', text: question, consent })) { setQuestion(''); setConsent(false); } }}>
      <label htmlFor={`${id}-question`}>Question about this draft<textarea id={`${id}-question`} required maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I understand this is a local rehearsal, with no publication or contact permission granted.</label>
      <button disabled={!consent || !question.trim()}>Add to rehearsal queue</button>
    </form>
    {error && <p role="alert">{error}</p>}<p role="status">{status}</p>
    <h3>Moderated Q&amp;A queue ({queue.questions.length}/25)</h3>
    <p>Try the fictional moderator and expert controls below. They confer no real permissions. Pending and declined questions cannot receive answers.</p>
    {!queue.questions.length && <p>No questions yet. Add a question to try moderation.</p>}
    {queue.questions.map(q => <article key={q.id} aria-label={`Question ${q.id}`}>
      <h4>Question {q.id} · {q.status}</h4><p>{q.text}</p><time dateTime={q.at}>{q.at}</time>
      {q.moderation && <p>Simulated moderator: {q.moderation.reason} · <time dateTime={q.moderation.at}>{q.moderation.at}</time></p>}
      {q.status === 'pending' && <Moderation onSubmit={(approve, reason) => apply({ type: 'moderate', id: q.id, approve, reason })} />}
      {q.answers.length > 0 && <><h4>Expert opinion · simulated</h4><p>{q.answers.at(-1)?.kind === 'withdrawal' ? 'Answer withdrawn. Do not rely on earlier versions.' : q.answers.at(-1)?.text}</p>
        {q.answers.at(-1)?.citation && <p>Source evidence note · unverified: {q.answers.at(-1)?.citation}</p>}
        <details><summary>Timestamped answer history ({q.answers.length})</summary><ol>{q.answers.map((a, n) => <li key={n}><strong>{a.kind}</strong> · <time dateTime={a.at}>{a.at}</time><p>{a.text}</p>{a.citation && <p>Source evidence note · unverified: {a.citation}</p>}{a.reason && <p>Reason: {a.reason}</p>}</li>)}</ol></details></>}
      {q.status === 'approved' && q.answers.at(-1)?.kind !== 'withdrawal' && <AnswerForm key={q.answers.length} correction={q.answers.length > 0} submit={(type, text, citation, reason) => apply({ type, id: q.id, text, citation, reason })} />}
    </article>)}
    <p>Live office hours are unavailable. Authenticated moderator/expert roles, independent credential review and a durable publication and removal process are required before real participation.</p>
  </section>;
}
function Moderation({ onSubmit }: { onSubmit: (approve: boolean, reason: string) => boolean }) {
  const [reason, setReason] = useState('');
  return <fieldset><legend>Simulated moderator</legend><label>Moderation reason<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><button type="button" disabled={!reason.trim()} onClick={() => onSubmit(true, reason)}>Approve question locally</button> <button type="button" disabled={!reason.trim()} onClick={() => onSubmit(false, reason)}>Decline question locally</button></fieldset>;
}
function AnswerForm({ correction, submit }: { correction: boolean; submit: (type: 'answer' | 'correction' | 'withdrawal', text: string, citation: string, reason: string) => boolean }) {
  const [text, setText] = useState(''); const [citation, setCitation] = useState(''); const [reason, setReason] = useState('');
  return <form onSubmit={e => { e.preventDefault(); submit(correction ? 'correction' : 'answer', text, citation, reason); }}><fieldset><legend>Simulated expert · {correction ? 'correct or withdraw' : 'answer'}</legend>
    <label>Expert opinion<textarea required maxLength={3000} value={text} onChange={e => setText(e.target.value)} /></label>
    <label>Source evidence note (title, URL, date, locator; say no evidence if unavailable)<textarea required maxLength={2000} value={citation} onChange={e => setCitation(e.target.value)} /></label>
    {correction && <label>Correction or withdrawal reason<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
    <button>{correction ? 'Record correction locally' : 'Record answer locally'}</button>{correction && <button type="button" disabled={!reason.trim()} onClick={() => submit('withdrawal', '', '', reason)}>Withdraw answer locally</button>}
  </fieldset></form>;
}
