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
export function advisoryReceiptText(draft: VoteDraft, includeStance = false) {
  const selection = draft.stance === 1 ? 'Support' : draft.stance === -1 ? 'Oppose' : 'Not sure';
  // Explicit public fields only; never serialize storage, cookies or the current URL.
  const link = `https://civic-synthesis.fly.dev/votes?proposal=${encodeURIComponent(draft.proposalId)}`;
  return [
    'Non-binding advisory decision receipt · independently operated beta · not an official ballot.',
    'Source repository: adnanwahab/dear_congress · kind: fictional sample proposal',
    `Sample proposal: ${draft.title} (${draft.proposalId})`,
    `Viewed text revision: ${draft.revision ?? 'unavailable (earlier saved choice)'}`,
    'Text fingerprint only; the server does not bind this vote to a revision.',
    'Options viewed: Support; Oppose; Not sure.',
    ...(includeStance ? [`Server confirmed advisory choice: ${selection}`] : []),
    'Not verified eligibility, turnout, or official electoral authority. Separate from synthetic demo responses.',
    `Proposal link (current text may differ): ${link}`,
  ].join('\n');
}
export function AdvisoryReceipt({ draft, busy, onChange }: { draft: VoteDraft; busy: boolean; onChange: () => void }) {
  const [copyStatus, setCopyStatus] = useState('');
  const [includeStance, setIncludeStance] = useState(false);
  const text = advisoryReceiptText(draft, includeStance);
  return <section className="advisory-receipt" aria-label="Advisory vote receipt">
    <p role="status" className="advisory-receipt-text"><strong className="advisory-receipt-stamp">Saved · advisory</strong>{'\n'}{text}</p>
    <p>Review the plain text below before copying or downloading. Browser cookie identifiers are excluded. Shared copies cannot be withdrawn.</p>
    <label><input type="checkbox" checked={includeStance} onChange={event => { setIncludeStance(event.target.checked); setCopyStatus(''); }} /> Include my chosen stance in the export (optional, off by default)</label>
    <label>Plain-text receipt preview<textarea readOnly value={text} /></label>
    <div className="advisory-receipt-actions">
      <button disabled={busy} onClick={onChange}>Change vote</button>
      <button onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopyStatus('Receipt copied.'); }
        catch { setCopyStatus('Could not copy. Select and copy the receipt text above.'); }
      }}>Copy receipt</button>
      <a download="advisory-decision-receipt.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>Download receipt (.txt)</a>
    </div>
    <p role="status">{copyStatus}</p>
  </section>;
}
