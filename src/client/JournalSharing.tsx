import { useRef, useState } from 'react';
import type { JournalEntry } from '../engine/types';

type Request = <T>(path: string, body?: unknown, method?: string) => Promise<T>;
type PublicExcerpt = Readonly<{ kind: 'journal'; text: string; author: string }>;

/** This boundary deliberately receives no private draft or editor metadata. */
export function publicExcerpt(text: string, author: string): PublicExcerpt {
  return Object.freeze({ kind: 'journal', text: text.trim(), author: author.trim() || 'Demo participant' });
}

export default function JournalSharing({ request, onPublished }: { request: Request; onPublished: (entry: JournalEntry) => void }) {
  const [draft, setDraft] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [author, setAuthor] = useState('');
  const [review, setReview] = useState<PublicExcerpt | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  function invalidate() { setReview(null); setConsent(false); setStatus(''); }
  async function publish() {
    if (!review || !consent || sending.current) return;
    if (!navigator.onLine) { invalidate(); setError('You are offline. Review and confirm again when online. Nothing was queued.'); return; }
    sending.current = true; setBusy(true); setError('');
    // Consume consent before the request; failures never retry automatically.
    const payload = review;
    setReview(null); setConsent(false);
    try {
      const result = await request<{ status?: string; entry?: JournalEntry }>('/api/publish_draft', payload);
      if (result.status === 'pending') setStatus('Excerpt held for moderation review. It is not in the public feed.');
      else if (result.entry) { setStatus('Excerpt published. Your working draft remains here.'); onPublished(result.entry); }
      else setError('Publication outcome is unknown. Check the shared feed before reviewing and trying again.');
    } catch {
      setError('Publication could not be confirmed. Check the shared feed before trying again; retrying may duplicate the excerpt. Your working draft remains here.');
    } finally { sending.current = false; setBusy(false); }
  }
  return <section aria-label="Deliberate public sharing">
    <p className="journal-public-note">Working drafts stay in this open page only. They are not saved or encrypted; refresh or leaving this page loses them. Use sample experiences while the encrypted vault is being built.</p>
    <label className="journal-label" htmlFor="journal-working-draft">Working draft (not uploaded)</label>
    <textarea id="journal-working-draft" rows={7} maxLength={10000} value={draft} disabled={busy} onChange={e => { setDraft(e.target.value); invalidate(); }} />
    <p>Copy only the words you intend to share into the separate excerpt below. Remove names, contact details and identifying context yourself; anonymity is not guaranteed.</p>
    <label className="journal-label" htmlFor="journal-excerpt">Public excerpt</label>
    <textarea id="journal-excerpt" rows={5} maxLength={10000} value={excerpt} disabled={busy} onChange={e => { setExcerpt(e.target.value); invalidate(); }} />
    <label className="journal-label" htmlFor="journal-author">Public display name (optional)</label>
    <input id="journal-author" maxLength={120} value={author} disabled={busy} onChange={e => { setAuthor(e.target.value); invalidate(); }} />
    <div className="journal-publish"><button type="button" disabled={busy || !excerpt.trim()} onClick={() => { setReview(publicExcerpt(excerpt, author)); setConsent(false); setError(''); }}>Review public excerpt</button></div>
    {review && <section aria-label="Exact public preview" className="journal-result">
      <h3>Exact public preview</h3><strong>{review.author}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.text}</p>
      <p>This excerpt and display name will be public through the feed and API and may be sent to configured AI providers for need extraction. No location is included. Copies and independently published proposals may remain after removal. Keep this browser’s cookies to retain removal ownership. <a href="/privacy">Privacy and deletion details</a>.</p>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I want to share this exact excerpt publicly.</label>
      <button type="button" disabled={!consent || busy} onClick={publish}>Share publicly</button>
      <button type="button" className="outline" onClick={invalidate}>Cancel sharing</button>
    </section>}
    <p role="status">{status}</p>{error && <p role="alert">{error}</p>}
  </section>;
}
