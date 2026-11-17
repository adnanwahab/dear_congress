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
  return `Sample scenario / not introduced bill\nScenario jurisdiction: $<bdi dir="auto">{item.jurisdiction}</bdi>\n$<bdi dir="auto">{item.background?.name ?? 'Source not available'}</bdi>\nPublisher: $<bdi dir="auto">{item.background?.publisher ?? 'Not available'}</bdi>\n${sourceUrl(item) ?? 'Source not available'}\n${freshness(item)}\n${item.background?.scope ?? 'Background scope not documented.'}\nBackground only; does not establish the scenario, current-rule wording, or proposed bill as official text.`;
}
export function ProposalProvenance({ item, compact = false }: { item: DemoItem; compact?: boolean }) {
  const url = sourceUrl(item);
  const full = <>
    <strong>Sample scenario / not introduced bill</strong>
    <div>Scenario jurisdiction: <bdi dir="auto">{item.jurisdiction}</bdi></div>
    <div>Background source: <bdi dir="auto">{item.background?.name ?? 'Source not available'}</bdi></div>
    <div>Publisher: <bdi dir="auto">{item.background?.publisher ?? 'Not available'}</bdi></div>
    {url && item.background?.publisher && <a href={url} target="_blank" rel="noopener noreferrer"><bdi dir="auto">{item.background.publisher}</bdi> — <bdi dir="auto">{item.background.name}</bdi> ↗</a>}
    <div>{freshness(item)}</div>
    <p>{item.background?.scope ?? 'Background scope not documented.'} Background only; does not establish the scenario, current-rule wording, or proposed bill as official text.</p>
  </>;
  if (!compact) return <section className="workflow-provenance" aria-label="Scenario and background source">{full}</section>;
  return <details className="workflow-provenance workflow-provenance-compact" aria-label="Scenario and background source">
    <summary>
      <span className="workflow-source-status">Sample scenario / not introduced bill</span>
      <span> · <bdi dir="auto">{item.jurisdiction}</bdi> · </span>
      {url ? <span><bdi dir="auto">{item.background?.name ?? 'Source not available'}</bdi></span> : <span>Source not available</span>}
      <span> · {freshness(item) === 'Source not available / not checked' ? 'Not checked' : freshness(item)} </span>
      <span className="workflow-source-toggle" aria-hidden="true">⌄</span>
    </summary>
    <div className="workflow-provenance-body">{full}</div>
  </details>;
}
