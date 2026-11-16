import { writeFailure, retryDeadline } from './write-failure';
import { StateFeedback } from './StateFeedback';
import { useRef, useState } from 'react';
import type { JournalEntry } from '../engine/types';

type Request = <T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) => Promise<T>;
type Need = { id: string; label: string };
export const SAMPLE = 'The bus to work is often late, and childcare costs are making it difficult to keep my shifts. More reliable transit and affordable care would help my family.';
type PublicExcerpt = Readonly<{ kind: 'journal'; text: string; author: string; inference: 'none'; labels: readonly string[]; synthetic?: true; source?: string }>;

/** This boundary deliberately receives no private draft or editor metadata. The person chooses
 * any need categories; no AI or keyword inference is requested. */
export function publicExcerpt(text: string, author: string, labels: readonly string[] = []): PublicExcerpt {
  const body = text.trim();
  const sample = body === SAMPLE ? { synthetic: true as const, source: 'civic-synthesis-demo' } : {};
  return Object.freeze({ kind: 'journal', text: body, author: author.trim() || 'Demo participant', inference: 'none', labels: Object.freeze([...labels]), ...sample });
}

export default function JournalSharing({ request, onPublished, needs = [] }: { request: Request; onPublished: (entry: JournalEntry) => void; needs?: Need[] }) {
  const [draft, setDraft] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState<PublicExcerpt | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const attempt = useRef<{ body: PublicExcerpt; idempotencyKey: string } | null>(null);
  const retryAt = useRef(0);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  function invalidate() { attempt.current = null; setFailed(false); setReview(null); setConsent(false); setStatus(''); }
  async function publish() {
    if (!review || !consent || sending.current) return;
    if (Date.now() < retryAt.current) { setError(`Too many requests. Retry after ${new Date(retryAt.current).toLocaleTimeString()}. Your text remains here.`); return; }
    if (!navigator.onLine) { setFailed(true); setError('You are offline. Your text remains here; retry when connected. Nothing was queued.'); return; }
    sending.current = true; setBusy(true); setError(''); setStatus('');
    const payload = attempt.current ??= { body: review, idempotencyKey: crypto.randomUUID() };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await request<{ status?: string; entry?: JournalEntry }>('/api/publish_draft', { ...payload.body, idempotencyKey: payload.idempotencyKey }, 'POST', controller.signal);
      if (!result.entry && result.status !== 'pending') throw new Error('Missing publication acknowledgement');
      setReview(null); setConsent(false); setFailed(false); attempt.current = null;
      if (result.status === 'pending') setStatus('Excerpt held for moderation review. It is not in the public feed.');
      else if (result.entry) { setStatus('Excerpt published. Your working draft remains here. No inference was requested and no vote was cast.'); onPublished(result.entry); }
      else setError('Publication outcome is unknown. Check the shared feed before reviewing and trying again.');
    } catch (failure) {
      retryAt.current = retryDeadline(failure);
      setFailed(true);
      setError(`${writeFailure(failure, controller.signal.aborted)} Publication could not be confirmed. Your text remains here. Retry sends the same excerpt with the same key.${retryAt.current ? ` Retry after ${new Date(retryAt.current).toLocaleTimeString()}.` : ''}`);
    } finally { clearTimeout(timer); sending.current = false; setBusy(false); }

  }
  return <section aria-label="Deliberate public sharing">
    <p className="journal-public-note">Working drafts stay in this open page only. They are not saved or encrypted; refresh or leaving this page loses them. Use sample experiences while the encrypted vault is being built.</p>
    <label className="journal-label" htmlFor="journal-working-draft">Working draft (not uploaded)</label>
    <textarea id="journal-working-draft" rows={7} maxLength={10000} value={draft} disabled={busy} onChange={e => { setDraft(e.target.value); invalidate(); }} />
    <p>Copy only the words you intend to share into the separate excerpt below. Remove names, contact details and identifying context yourself; anonymity is not guaranteed.</p>
    <label className="journal-label" htmlFor="journal-excerpt">Public excerpt</label>
    <textarea id="journal-excerpt" rows={5} maxLength={10000} value={excerpt} disabled={busy} onChange={e => { setExcerpt(e.target.value); invalidate(); }} />
    <div className="journal-form-meta"><button type="button" className="journal-text-button" disabled={busy} onClick={() => { setExcerpt(SAMPLE); invalidate(); }}>Use a sample experience</button><span>{excerpt.length.toLocaleString()} / 10,000</span></div>
    <label className="journal-label" htmlFor="journal-author">Public display name (optional)</label>
    <input id="journal-author" maxLength={120} value={author} disabled={busy} onChange={e => { setAuthor(e.target.value); invalidate(); }} />
    <fieldset disabled={busy}><legend>Choose needs yourself (optional)</legend><p>No AI or keyword inference is requested. Leave every category unchecked to share without tags. These choices do not cast votes.</p>{needs.map(n => <label key={n.id} style={{ display: 'block' }}><input type="checkbox" checked={selected.includes(n.id)} onChange={e => { setSelected(ids => e.target.checked ? [...ids, n.id] : ids.filter(id => id !== n.id)); invalidate(); }} /> {n.label}</label>)}</fieldset>
    <div className="journal-publish"><button type="button" disabled={busy || !excerpt.trim()} onClick={() => { setFailed(false); setReview(publicExcerpt(excerpt, author, selected)); setConsent(false); setError(''); }}>Review public excerpt</button></div>
    {review && <section aria-label="Exact public preview" className="journal-result">
      <h3>Exact public preview</h3><strong>{review.author}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.text}</p>
      <p>{review.labels.length ? `Categories: ${review.labels.map(id => needs.find(n => n.id === id)?.label ?? id).join(', ')}` : 'No categories selected.'}</p>
      <p>This excerpt, display name and the categories you selected will be public through the feed and API. No AI or keyword inference is requested. No location is included. Copies and independently published proposals may remain after removal. Keep this browser’s cookies to retain removal ownership. <a href="/privacy">Privacy and deletion details</a>.</p>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I want to share this exact excerpt publicly.</label>
      <button type="button" disabled={!consent || busy} onClick={publish}>{failed ? 'Retry exact excerpt' : 'Share publicly'}</button>
      <button type="button" className="outline" disabled={busy} onClick={invalidate}>Cancel sharing</button>
    </section>}
    <p role="status"><StateFeedback state={busy ? 'syncing' : status ? 'updated' : 'draft'}>{busy ? 'Submitting your reviewed excerpt…' : status || 'Draft in this open page only · not saved or uploaded.'}</StateFeedback></p>{error && <p role="alert"><StateFeedback state="error">{error}</StateFeedback></p>}
  </section>;
}
