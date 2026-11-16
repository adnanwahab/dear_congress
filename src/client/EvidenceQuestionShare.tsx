import { useEffect, useRef, useState } from 'react';
import { evidenceQuestionShare, QUESTION_LIMIT, sharedQuestion, type QuestionProposal } from './evidence-question-share';

export function EvidenceQuestionShare({ proposal }: { proposal: QuestionProposal }) {
  const [question, setQuestion] = useState(() => sharedQuestion(window.location.search));
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === '#evidence') {
      panel.current?.focus();
      panel.current?.scrollIntoView?.({ block: 'start' });
    }
  }, []);
  return <section id="evidence" ref={panel} tabIndex={-1} className="cp-panel" aria-labelledby="evidence-heading" style={{ overflowWrap: 'anywhere' }}>
    <h2 id="evidence-heading">Evidence and open questions</h2>
    <p>Author-supplied supporting information; sources and claims have not been verified.</p>
    <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.supportingInfo || 'No supporting information supplied.'}</p>
    <label className="cp-field"><span>Which unresolved factual question matters most?</span><textarea maxLength={QUESTION_LIMIT} rows={3} value={question} onChange={e => { setQuestion(e.target.value); setPreview(''); setStatus(''); }} /></label>
    <p>Choose one question about this proposal that evidence could help answer. The sharer chooses its importance; the app does not rank questions or verify that they remain unresolved. Shared questions are reader-supplied, not part of the original proposal.</p>
    <p>Review before copying. The question will be public in the link, browser history and hosting logs. Leave out personal information. No message is sent by this tool.</p>
    <button className="cp-button cp-button-secondary" disabled={!question.trim()} onClick={() => { setPreview(evidenceQuestionShare(proposal, question, window.location.origin)); setStatus(''); }}>Preview question share</button>
    {preview && <div><label className="cp-field"><span>Share text</span><textarea readOnly rows={12} value={preview} /></label><button className="cp-button" onClick={async () => {
      try { await navigator.clipboard.writeText(preview); setStatus('Share text copied.'); }
      catch { setStatus('Copy unavailable. Select and copy the share text above.'); }
    }}>Copy question share</button></div>}
    <p role="status">{status}</p>
  </section>;
}
