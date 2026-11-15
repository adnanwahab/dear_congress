import { useState } from 'react';
import type { VoteDraft } from './advisory-mutation';
import type { DemoItem } from '../engine/demo';
import './advisory-vote-bars.css';

// A local text identifier, never a server revision or verified ballot identifier.
export function sampleTextRevision(item: DemoItem) {
  const text = JSON.stringify([item.id, item.title, item.currentText, item.proposedText]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `text-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export function advisoryReceiptText(draft: VoteDraft) {
  const selection = draft.stance === 1 ? 'Support' : draft.stance === -1 ? 'Oppose' : 'Not sure';
  return `Server confirmed advisory choice: ${selection}\nSample proposal: ${draft.title} (${draft.proposalId})\nViewed text revision: ${draft.revision ?? 'unavailable (earlier saved choice)'}\nText fingerprint only; the server does not bind this vote to a revision.\nNon-binding browser choice. Not verified eligibility, turnout, or official electoral authority. Separate from synthetic demo responses.`;
}
export function AdvisoryReceipt({ draft, busy, onChange }: { draft: VoteDraft; busy: boolean; onChange: () => void }) {
  const [copyStatus, setCopyStatus] = useState('');
  const text = advisoryReceiptText(draft);
  return <section className="advisory-receipt" aria-label="Advisory vote receipt">
    <p role="status" className="advisory-receipt-text"><strong className="advisory-receipt-stamp">Saved · advisory</strong>{'\n'}{text}</p>
    <div className="advisory-receipt-actions">
      <button disabled={busy} onClick={onChange}>Change vote</button>
      <button onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopyStatus('Receipt copied.'); }
        catch { setCopyStatus('Could not copy. Select and copy the receipt text above.'); }
      }}>Copy receipt</button>
    </div>
    <p role="status">{copyStatus}</p>
  </section>;
}
