import { useState } from 'react';
import { DEMO_ITEMS } from '../engine/demo';

/** Only curated sample fields; never takes a stance, identity or referral parameter. */
export function discussionInvitation(id: string, origin: string) {
  const item = DEMO_ITEMS.find(sample => sample.id === id);
  if (!item) throw new Error('Sample unavailable');
  const url = new URL('/published', origin);
  url.searchParams.set('proposal', item.id);
  return [
    'Would you like to compare this proposal with me? Read the reasons for and concerns, then discuss what evidence would change our minds. No need to vote or agree.',
    'Independently operated non-binding beta · fictional sample proposal · not an official election or government service. This invitation conveys no collective voting authority.',
    `Source repository: adnanwahab/dear_congress · kind: sample scenario · ${item.id}`,
    item.title,
    'Arguments are editorial examples, not verified findings. Some samples have no reviewed arguments yet. Background references do not verify claims. The linked sample may change.',
    url.href,
  ].join('\n\n');
}

export function DiscussionInvitation({ id }: { id: string }) {
  return <Invitation key={id} id={id} />;
}
function Invitation({ id }: { id: string }) {
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(copy: boolean) {
    if (busy) return;
    setBusy(true); setStatus('');
    try {
      if (copy) {
        await navigator.clipboard.writeText(preview);
        setStatus('Invitation copied. You decide whether and with whom to share it.');
      } else {
        await navigator.share({ title: 'Compare a fictional sample proposal', text: preview });
        setStatus('Share sheet closed. This does not establish reading, participation or agreement.');
      }
    } catch (error) {
      setStatus(error instanceof Error && error.name === 'AbortError' ? 'Sharing canceled. Nothing else was sent or copied.' : 'Unable to share or copy. You can select the preview text and copy it manually.');
    } finally { setBusy(false); }
  }
  return <section className="advisory-share" aria-label="Discussion invitation">
    <button type="button" className="outline" aria-expanded={!!preview} onClick={() => {
      setStatus('');
      setPreview(preview ? '' : discussionInvitation(id, window.location.origin));
    }}>Compare this proposal with someone</button>
    {preview && <div>
      <p>Review this invitation first. Ask someone who is open to discussing it. No contacts are accessed, no automatic messages are sent, and no rewards depend on sharing or stance.</p>
      <label>Invitation preview<textarea readOnly value={preview} rows={12} /></label>
      {typeof navigator.share === 'function' && <button type="button" disabled={busy} onClick={() => void send(false)}>Open device share sheet</button>}
      <button type="button" disabled={busy} onClick={() => void send(true)}>Copy invitation</button>
      <p>Copies you send cannot be withdrawn from recipients. Sharing is optional and is not evidence of useful participation or comprehension.</p>
    </div>}
    <p role="status">{status}</p>
  </section>;
}
