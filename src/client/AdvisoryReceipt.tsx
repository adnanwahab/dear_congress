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
export function advisoryReceiptText(draft: VoteDraft, phase = 'confirmed', acknowledgedAt?: string) {
  const selection = draft.stance === 1 ? 'Support' : draft.stance === -1 ? 'Oppose' : 'Not sure';
  return `${phase === 'confirmed' ? (draft.withdraw ? 'Server confirmed withdrawal of advisory choice' : 'Server confirmed advisory choice') : (draft.withdraw ? 'Withdrawal unconfirmed for advisory choice' : 'Save unconfirmed for advisory choice')}: ${selection}\nStatus: ${phase === 'confirmed' ? (draft.withdraw ? 'Withdrawn' : 'Saved') : phase === 'submitting' ? 'Pending' : 'Failed / outcome unknown'}\nBrowser received acknowledgement: ${acknowledgedAt ?? 'unknown'}\nSample proposal: ${draft.title} (${draft.proposalId})\nViewed text revision: ${draft.revision ?? 'unavailable (earlier saved choice)'}\nAcknowledgement records this request only; later changes in this browser or another tab may supersede it.\nText fingerprint only; the server does not bind this vote to a revision.\nOne choice per browser cookie; clearing cookies can create another identity. This does not prove a unique person. Non-binding browser choice. Not verified eligibility, turnout, or official electoral authority. Separate from synthetic demo responses.`;
}
export function AdvisoryReceipt({ draft, busy, onChange, onWithdraw, phase = 'confirmed', acknowledgedAt }: { draft: VoteDraft; busy: boolean; onChange: () => void; onWithdraw?: () => void; phase?: string; acknowledgedAt?: string }) {
  const [copyStatus, setCopyStatus] = useState('');
  const text = advisoryReceiptText(draft, phase, acknowledgedAt);
  return <section className="advisory-receipt" aria-label="Advisory vote receipt">
    <p role="status" className="advisory-receipt-text"><strong className="advisory-receipt-stamp">{phase === 'confirmed' ? (draft.withdraw ? 'Withdrawn' : 'Saved') : phase === 'submitting' ? 'Pending' : 'Failed / outcome unknown'} · advisory</strong>{'\n'}{text}</p>
    <div className="advisory-receipt-actions">
      <button disabled={busy} onClick={onChange}>Change vote</button>
      <button onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopyStatus('Receipt copied.'); }
        catch { setCopyStatus('Could not copy. Select and copy the receipt text above.'); }
      }}>Copy receipt</button>
      {onWithdraw && !draft.withdraw && <button disabled={busy} onClick={onWithdraw}>Withdraw vote</button>}
    </div>
    <p role="status">{copyStatus}</p>
  </section>;
}
