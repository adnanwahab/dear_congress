import { useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { provenanceText } from './ProposalProvenance';
import { sampleTextRevision } from './AdvisoryReceipt';

export function advisoryExplanation(item: DemoItem) {
  return `Civic Synthesis · independent advisory beta\nFictional sample: ${item.title} (${item.id})\nViewed text: ${sampleTextRevision(item)}\n\nIllustrative current approach: ${item.currentText}\nPossible change: ${item.proposedText}\nIntended benefit (not a measured outcome): ${item.summary}\n\nQuestions to investigate: Who benefits or bears costs? What funding, capacity and safeguards are needed? What evidence would change the assessment?\nNo cost estimate or verified outcome is supplied here. This comparison is hypothetical, not a forecast or enacted policy.\n\nBackground only: ${provenanceText(item)}\n\nNon-binding, cookie-based browser choices do not verify eligibility or public support. This explanation contains no personal vote or participation receipt.`;
}

export function AdvisoryNextStep({ item }: { item: DemoItem }) {
  const [copyStatus, setCopyStatus] = useState('');
  const explanation = advisoryExplanation(item);
  return <section className="advisory-next-step" aria-label="After your advisory choice">
    <h3>What could this change?</h3>
    <p>Your non-binding advisory choice is associated with this browser’s cookie, not a verified person. It does not enact policy or contact an official. Clearing cookies can lose access to your choice.</p>
    <p>Explore {item.title}. Every choice has the same next steps; continuing is optional.</p>
    <details><summary>See trade-offs</summary>
      <p><strong>Intended benefit · fictional sample:</strong> {item.summary}</p>
      <p>Who would benefit, who might be left out, and who would bear the costs? Compare funding, delivery capacity and safeguards before drawing a conclusion. No cost estimate or verified benefit is supplied here.</p>
    </details>
    <details><summary>Compare a possible future</summary>
      <p>Hypothetical comparison of sample text, not a forecast, measured outcome or enacted policy.</p>
      <h4>Without this proposed change · illustrative</h4><p>{item.currentText}</p>
      <h4>If the proposed change were adopted · illustrative</h4><p>{item.proposedText}</p>
      <p>Would the intended benefit occur? Adoption, funding and implementation remain uncertain. Compare a baseline and later measurements, including costs and effects on different groups, before claiming success.</p>
    </details>
    <details><summary>Share this explanation</summary>
      <p>Review and copy the explanation yourself. Your vote and browser identity are excluded. Nothing is posted or sent.</p>
      <label>Explanation to copy<textarea readOnly value={explanation} rows={10} /></label>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(explanation); setCopyStatus('Explanation copied. Nothing was posted or sent.'); }
        catch { setCopyStatus('Could not copy. Select and copy the explanation above.'); }
      }}>Copy explanation</button>
      <p role="status">{copyStatus}</p>
    </details>
  </section>;
}
