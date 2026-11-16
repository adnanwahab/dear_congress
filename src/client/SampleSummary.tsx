import type { DemoItem } from '../engine/demo';

/** Read-only explanation; original draft text and source identity stay attached. */
export function SampleSummary({ item }: { item: DemoItem }) {
  return <section aria-label={`Plain-language summary: ${item.title}`}>
    <p>{item.summary}</p>
    {item.keyCaveat && <p><strong>Key caveat:</strong> {item.keyCaveat}</p>}
    <p>Fictional sample, not reviewed. Your advisory vote does not change the law.</p>
    <details>
      <summary>Full details: {item.title}</summary>
      <h4>Illustrative current approach — not quoted law</h4><p>{item.currentText}</p>
      <h4>Sample draft wording — not an introduced bill</h4><p>{item.proposedText}</p>
      <p>Background links provide context only. They do not verify this sample or its description of current rules. Proposed targets are not measurements or forecasts.</p>
    </details>
  </section>;
}
