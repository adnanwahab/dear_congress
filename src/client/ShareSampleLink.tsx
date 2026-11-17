import { useRef, useState } from 'react';
import { DEMO_ITEMS } from '../engine/demo';
import { SHARE_NOTICE } from './advisory-share';
import { stageRoute } from '../shared/civic-stages';

/** Reconstruct from a public catalog ID; never forward the current query or private state. */
export function sampleShareData(id: string, origin: string): ShareData {
  const item = DEMO_ITEMS.find(item => item.id === id);
  if (!item) throw new Error('Sample proposal unavailable');
  return { title: 'Civic Synthesis · fictional sample proposal',
    text: `${SHARE_NOTICE}. Independently operated beta. Fictional sample: ${item.title}`,
    url: new URL(stageRoute('votes', id), origin).href };
}

export function ShareSampleLink({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [manual, setManual] = useState('');
  const pending = useRef(false);
  async function send(native: boolean) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setManual(''); setFeedback('');
    try {
      const data = sampleShareData(id, window.location.origin);
      if (native && typeof navigator.share === 'function' &&
          (typeof navigator.canShare !== 'function' || navigator.canShare(data))) {
        try {
          // Invoke directly in the click handler, before any await loses user activation.
          await navigator.share(data);
          setFeedback('Share sheet completed. Delivery is not verified.');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            setFeedback('Sharing canceled. Nothing copied.'); return;
          }
          setManual(data.url!);
          setFeedback('Sharing unavailable. Tap Copy link or copy the link below.');
          return;
        }
      }
      try {
        await navigator.clipboard.writeText(data.url!);
        setFeedback('Link copied. Your saved vote and journal text are excluded.');
      } catch {
        setManual(data.url!);
        setFeedback('Could not copy automatically. Select and copy the link below.');
      }
    } catch { setFeedback('Sample link unavailable. Try another sample proposal.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="sample-link-share">
    <p>Share this public fictional sample only. Your saved vote and journal text are excluded.</p>
    <div className="sample-link-actions">
      <button type="button" className="outline" disabled={busy} onClick={() => void send(true)}>Share link</button>
      <button type="button" className="outline" disabled={busy} onClick={() => void send(false)}>Copy link</button>
    </div>
    {(busy || feedback) && <p role="status" aria-live="polite">{busy ? 'Opening share or copy…' : feedback}</p>}
    {manual && <label>Link to copy<input readOnly value={manual} onFocus={event => event.currentTarget.select()} /></label>}
  </div>;
}
