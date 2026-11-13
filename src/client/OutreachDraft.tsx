import { useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';

/** Draft preparation only. No transport, storage or contact-verification authority. */
export function OutreachDraft({ item, office }: { item: DemoItem; office: string }) {
  const [subject, setSubject] = useState(`Discussion request: ${item.title}`);
  const [body, setBody] = useState(`I am writing as an individual citizen to ask about this fictional policy scenario:\n\n${item.summary}\n\nThis is a discussion request, not a public mandate, official proposal or endorsement. What would need to be reviewed before considering such an idea?`);
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const subjectInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const valid = subject.trim().length > 0 && body.trim().length > 0 && subject.length <= 200 && body.length <= 10000;
  function edit() { setReviewed(false); setConfirmed(false); setStatus('Draft changed. Review again before downloading.'); }
  function download() {
    if (!valid || !reviewed || !confirmed) return;
    const text = `SAMPLE OUTREACH DRAFT — NOT SENT\nFictional scenario: ${item.title}\nScenario ID: ${item.id}\nJurisdiction: ${item.jurisdiction}\nPossible office category: ${office}\nRecipient: NOT VERIFIED — no contact address supplied\nSource/contact check: not performed\n\nSubject: ${subject}\n\n${body}\n\nNo office has been contacted. This file is not a sending receipt.\n`;
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'sample-outreach-draft.txt'; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Reviewed draft downloaded. No office contacted; no sent or replied status recorded.');
    } catch { setStatus('Download unavailable. You can select and copy the reviewed text below. No office contacted.'); }
  }
  return <section className="panel outreach-draft" aria-label="Editable outreach draft">
    <h2>Review an outreach draft</h2>
    <p>Sample preparation only. {office} is an unverified office category, not a recipient. No contact address or sending action is available.</p>
    <p>Edits stay in this page’s memory and are lost when you leave or change proposal or office. Nothing is uploaded or saved to browser storage. Downloads may contain personal details you add; keep them private.</p>
    <label>Subject<input ref={subjectInput} value={subject} maxLength={200} onChange={e => { setSubject(e.target.value); edit(); }} /></label>
    <label>Message<textarea value={body} maxLength={10000} rows={9} onChange={e => { setBody(e.target.value); edit(); }} /></label>
    <button ref={reviewButton} disabled={!valid} onClick={() => { setReviewed(true); setConfirmed(false); setStatus('Review the exact draft below.'); window.setTimeout(() => preview.current?.focus(), 0); }}>Review exact draft</button>
    {reviewed && <div>
      <h3 ref={preview} tabIndex={-1}>Draft review · not sent</h3>
      <p>Scenario: {item.title} · {item.id} · {item.jurisdiction}</p>
      <p>Possible office: {office}. Recipient unverified; contact check not performed.</p>
      <strong>{subject}</strong><pre className="outreach-preview">{body}</pre>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed this exact sample text and understand downloading does not contact an office.</label>
      <div className="workflow-card-actions"><button disabled={!confirmed} onClick={download}>Download reviewed draft</button><button className="outline" onClick={() => { setReviewed(false); setConfirmed(false); setStatus('Review cancelled. No office contacted.'); subjectInput.current?.focus(); }}>Edit draft</button><button className="outline" onClick={() => { setReviewed(false); setConfirmed(false); setStatus('Review cancelled. No office contacted.'); reviewButton.current?.focus(); }}>Cancel review</button></div>
    </div>}
    <p role="status" aria-live="polite">{status}</p>
    <a href={`/outcomes?proposal=${encodeURIComponent(item.id)}`}>View simulated outcomes →</a>
  </section>;
}
