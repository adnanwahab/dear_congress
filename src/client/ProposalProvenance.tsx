import type { DemoItem } from '../engine/demo';

// References are editorial metadata, independent of demo activity and browser votes.
export function sourceUrl(item: DemoItem): string | null {
  try {
    const url = new URL(item.sourceUrl);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function freshness(item: DemoItem, now = Date.now()): string {
  const checked = item.background?.checkedAt;
  const timestamp = checked && /^\d{4}-\d{2}-\d{2}$/.test(checked) ? Date.parse(`${checked}T00:00:00Z`) : NaN;
  if (!sourceUrl(item) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== checked || timestamp > now || now - timestamp > 30 * 86400000) {
    return 'Source not available / not checked';
  }
  return `Source checked ${checked}`;
}
export function provenanceText(item: DemoItem): string {
  return `Sample scenario / not introduced bill\nScenario jurisdiction: ${item.jurisdiction}\n${item.background?.name ?? 'Source not available'}\nPublisher: ${item.background?.publisher ?? 'Not available'}\n${sourceUrl(item) ?? 'Source not available'}\n${freshness(item)}\n${item.background?.scope ?? 'Background scope not documented.'}\nBackground only; does not establish the scenario, current-rule wording, or proposed bill as official text.`;
}
export function ProposalProvenance({ item }: { item: DemoItem }) {
  const url = sourceUrl(item);
  return <section className="workflow-provenance" aria-label="Scenario and background source">
    <strong>Sample scenario / not introduced bill</strong>
    <div>Scenario jurisdiction: {item.jurisdiction}</div>
    <div>Background source: {item.background?.name ?? 'Source not available'}</div>
    <div>Publisher: {item.background?.publisher ?? 'Not available'}</div>
    {url && item.background?.publisher && <a href={url} target="_blank" rel="noopener noreferrer">{item.background.publisher} — {item.background.name} ↗</a>}
    <div>{freshness(item)}</div>
    <p>{item.background?.scope ?? 'Background scope not documented.'} Background only; does not establish the scenario, current-rule wording, or proposed bill as official text.</p>
  </section>;
}
