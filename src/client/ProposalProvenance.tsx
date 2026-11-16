import { EvidenceExport } from './EvidenceExport';
import { ClaimEvidence } from './ClaimEvidence';
import type { EvidenceClaim } from '../shared/claim-provenance';
import { useEffect, useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { provenanceLines, type Provenance } from '../shared/provenance';
import { ProvenanceBadge } from './ProvenanceBadge';

export function scenarioProvenance(item: DemoItem): Provenance {
  return { origin: 'demo-fiction', date: null, jurisdiction: item.jurisdiction, confidence: 'Illustrative only', limitations: 'Fictional scenario and seeded response counts; not a representative poll. Background link is context only, not evidence for the numeric claims.', link: sourceUrl(item) };
}

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
  return `${provenanceLines(scenarioProvenance(item)).join('\n')}\nSample scenario / not introduced bill\nScenario jurisdiction: ${item.jurisdiction}\n${item.background?.name ?? 'Source not available'}\nPublisher: ${item.background?.publisher ?? 'Not available'}\n${sourceUrl(item) ?? 'Source not available'}\n${freshness(item)}\n${item.background?.scope ?? 'Background scope not documented.'}\nBackground only; does not establish the scenario, current-rule wording, or proposed bill as official text.`;
}
export function ProposalProvenance({ item, compact = false, claims = [] }: { item: DemoItem; compact?: boolean; claims?: readonly EvidenceClaim[] }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const panel = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  function dismiss(restoreFocus = false) {
    pinned.current = false;
    if (restoreFocus) trigger.current?.focus();
    setOpen(false);
  }
  useEffect(() => { pinned.current = false; setOpen(false); }, [item]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); dismiss(!!panel.current?.contains(document.activeElement)); } };
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node)) dismiss(); };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  const url = sourceUrl(item);
  const full = <>
    <strong>Sample scenario / not introduced bill</strong>
    <div>Scenario jurisdiction: {item.jurisdiction}</div>
    <div>Background source: {item.background?.name ?? 'Source not available'}</div>
    <div>Original claim: Unavailable — no original source claim or quotation is recorded.</div>
    <div>Publication date: Not available</div>
    <div>Publisher: {item.background?.publisher ?? 'Not available'}</div>
    {url && item.background?.publisher && <a href={url} target="_blank" rel="noopener noreferrer">{item.background.publisher} — {item.background.name} ↗</a>}
    {(!url || !item.background?.publisher) && <div role="note">Unsupported source — a safe HTTPS original and publisher are required.</div>}
    <div role="status">{freshness(item)} · Editorial background; successful fetch and schema monitoring are not recorded.</div>
    <p>Editorial inference · Publication and observation dates unknown. Source age does not determine validity. <a href="/outcomes#policy-measurements">Browse evidence freshness calendar</a>.</p>
    <p>Scope: {item.background?.scope ?? 'Background scope not documented.'} Limitations: Background only; does not establish the scenario, current-rule wording, or proposed bill as official text.</p>
    {claims.length > 0 && <ClaimEvidence claims={claims} />}
    <ProvenanceBadge provenance={scenarioProvenance(item)} />
  </>;
  if (!compact) return <section className="workflow-provenance" aria-label="Scenario and background source">{full}<EvidenceExport key={JSON.stringify(item)} item={item} /></section>;
  return <details ref={panel} open={open}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true); }}
    onPointerLeave={() => { if (!pinned.current && !panel.current?.contains(document.activeElement)) setOpen(false); }}
    onFocus={() => setOpen(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) dismiss(); }}
    className="workflow-provenance workflow-provenance-compact" aria-label="Scenario and background source">
    <summary ref={trigger} onClick={event => { event.preventDefault(); if (pinned.current) dismiss(); else { pinned.current = true; setOpen(true); } }}>
      <span className="workflow-source-status">Sample scenario / not introduced bill</span>
      <span> · {item.jurisdiction} · </span>
      {url ? <span>{item.background?.name ?? 'Source not available'}</span> : <span>Source not available</span>}
      <span> · {freshness(item) === 'Source not available / not checked' ? 'Not checked' : freshness(item)} </span>
      <span className="workflow-source-toggle" aria-hidden="true">⌄</span>
    </summary>
    <div className="workflow-provenance-body">{full}<button type="button" className="outline" onClick={() => dismiss(true)}>Close source inspection</button><EvidenceExport key={JSON.stringify(item)} item={item} /></div>
  </details>;
}
