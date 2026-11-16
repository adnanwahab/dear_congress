import { useEffect, useId, useRef, useState } from 'react';
import { AmendmentComparison } from './AmendmentEditor';
import type { AmendmentSource } from './amendment-drafts';

export interface DuetSource extends AmendmentSource { supportingInfo?: string; sourceEntryId?: string; }
interface DuetCopy { id: number; text: string; rationale: string; }

/** Private, page-memory exploration. No publication or permission is inferred. */
export function ProposalDuet({ source }: { source: DuetSource }) {
  const id = useId();
  const [base] = useState(() => ({ ...source }));
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(base.text);
  const [rationale, setRationale] = useState('');
  const [copies, setCopies] = useState<DuetCopy[]>([]);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const originalChanged = JSON.stringify(base) !== JSON.stringify(source);
  const parent = copies.at(-1);
  useEffect(() => {
    if (!open || (!copies.length && text === base.text && !rationale)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, copies.length, text, rationale, base.text]);
  return <section className="amendment-editor" aria-label="Civic duet">
    <button type="button" aria-expanded={open} aria-controls={`${id}-duet`} onClick={() => { setOpen(true); window.setTimeout(() => heading.current?.focus(), 0); }}>Duet · propose an alternative</button>
    {open && <div id={`${id}-duet`}>
      <h2 ref={heading} tabIndex={-1}>Build on this idea respectfully</h2>
      <p>Private working copy · kept only on this page, lost when you leave or reload. Nothing is saved, published, sent for moderation or voted on.</p>
      <p>{base.kind === 'sample' ? 'Fictional sample · not legal text' : 'Citizen-authored proposal · author identity not verified'}. Original author credit stays with the source proposal; this alternative does not imply their endorsement.</p>
      <p>Original: {base.title} · {base.jurisdiction} · {base.kind}:{base.id} · {base.origin}</p>
      {base.kind === 'citizen' && <a href={`/proposals/${encodeURIComponent(base.id)}`}>Read the original proposal and attribution</a>}
      {base.sourceEntryId && <p>Source journal identity: {base.sourceEntryId}. Journal text and personal attachments are not imported.</p>}
      {base.supportingInfo && <details><summary>Original supporting information · unverified</summary><p className="amendment-text">{base.supportingInfo}</p></details>}
      <p>Keep the focus on the idea. Do not copy personal stories, names, images or other personal content without the affected person’s permission. Public forks remain unavailable until permission and moderation safeguards exist.</p>
      {originalChanged && <p role="alert">The source changed. Reopen this proposal before preparing another duet; this working copy retains its original snapshot.</p>}
      <form onSubmit={event => {
        event.preventDefault();
        if (originalChanged) return;
        if (!text.trim() || !rationale.trim() || text === (parent?.text ?? base.text)) { setError('Change the text and explain how your alternative builds on the idea.'); return; }
        if (copies.length >= 20) { setError('This page has 20 private copies. Keep your work before leaving.'); return; }
        setCopies([...copies, { id: copies.length + 1, text, rationale }]); setRationale(''); setError('');
      }}>
        <label htmlFor={`${id}-text`}>Your alternate proposal<textarea id={`${id}-text`} required maxLength={10000} rows={6} value={text} onChange={event => setText(event.target.value)} /></label>
        <label htmlFor={`${id}-why`}>What you appreciate and what you would change<textarea id={`${id}-why`} required maxLength={3000} rows={3} value={rationale} onChange={event => setRationale(event.target.value)} /></label>
        <h3>Changes from the original</h3><AmendmentComparison before={base.text} after={text} />
        {parent && <><h3>Changes from private copy {parent.id}</h3><AmendmentComparison before={parent.text} after={text} /></>}
        <button type="submit" disabled={originalChanged}>Keep private copy on this page</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p role="status">{copies.length ? `Private copy ${copies.length} kept on this page. You can build on it in the editor; nothing is published.` : ''}</p>
      {copies.length > 0 && <ol aria-label="Duet provenance chain">{copies.map(copy => <li key={copy.id}><details><summary>Private copy {copy.id} · from {copy.id === 1 ? `original ${base.kind}:${base.id}` : `private copy ${copy.id - 1}`} · this browser, unverified</summary><p className="amendment-text">{copy.text}</p><p>{copy.rationale}</p></details></li>)}</ol>}
    </div>}
  </section>;
}
