import { useEffect, useId, useRef, useState } from 'react';
import './impact-view.css';

export type ImpactStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'unavailable';
export interface ImpactClause {
  clauseId: string;
  sourcePolicyId: string | null;
  operation: 'add' | 'remove' | 'modify';
  beforeText: string;
  afterText: string;
}
/** Public presentation data only. The integrator must project server records onto this shape. */
export interface ImpactViewData {
  schemaVersion: 'policy-impact-preview.v1';
  proposalId: string;
  versionId: string;
  baseVersionId: string;
  contentHash: string;
  title: string;
  type: 'bill' | 'constitutional-amendment';
  legalStatus: string;
  clauses: ImpactClause[];
  simulation: { seed: number; runs: number; months: number };
  modelVersion?: string;
  mappingVersion?: string;
  supportStatus: 'supported' | 'partial' | 'unavailable';
  job?: { status: ImpactStatus; completedPairs?: number; failedPairs?: number };
  remote?: { id: string; url: string };
  freshness: 'current' | 'stale' | 'revised-source';
  mappings: { clauseId: string; mappingVersion: string; parameter: string; before: string; after: string; units: string; support: string; explanation: string; assumptions: string[]; limitations: string[] }[];
  uncertainties: string[];
}
export interface ImpactViewProps {
  data: ImpactViewData;
  /** Stable same-origin URLs supplied by the route owner; no route is registered here. */
  permalink: string;
  reviseUrl: string;
  versions: { versionId: string; label: string; href: string }[];
  hblOrigin: string;
  civicOrigin: string;
  /** Operator-verified exact HBL frame-ancestors origin. Absent config disables embedding. */
  allowedCivicOrigin?: string;
  gpuAvailable?: boolean;
}
export function localImpactLink(value: string): string | undefined {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) return;
  const url = new URL(value, 'https://civic.invalid');
  if (url.origin !== 'https://civic.invalid') return;
  return value;
}
/** Accept only the returned canonical viewer URL. Never construct a success URL. */
export function safeHblViewer(remote: ImpactViewData['remote'], origin: string): string | undefined {
  try {
    const expected = new URL(origin), url = new URL(remote?.url ?? '');
    if (expected.protocol !== 'https:' || expected.href !== `${expected.origin}/` || expected.username || expected.password) return;
    if (url.origin !== expected.origin || url.username || url.password || url.hash || url.pathname !== '/world/impact') return;
    if (!/^pp_[a-f0-9]{64}$/.test(remote?.id ?? '') || url.search !== `?preview=${remote!.id}`) return;
    return url.href;
  } catch { return; }
}
function exactHttpsOrigin(value?: string): string | undefined {
  try { const u = new URL(value ?? ''); return u.protocol === 'https:' && value === u.origin ? value : undefined; } catch { return; }
}

export function ImpactView(props: ImpactViewProps) {
  const { data: d } = props;
  const heading = useId();
  // A revision change remounts frame state; old load/error signals cannot bless a new frame.
  const identity = `${d.proposalId}/${d.baseVersionId}/${d.versionId}/${d.contentHash}/${d.remote?.id}/${d.remote?.url}`;
  const viewer = safeHblViewer(d.remote, props.hblOrigin);
  const framing = exactHttpsOrigin(props.civicOrigin) !== undefined && props.allowedCivicOrigin === props.civicOrigin && props.hblOrigin !== props.civicOrigin;
  const current = d.freshness === 'current';
  const limits = Number.isInteger(d.simulation.runs) && d.simulation.runs >= 1 && d.simulation.runs <= 100 && Number.isInteger(d.simulation.months) && d.simulation.months >= 1 && d.simulation.months <= 24;
  const usable = !!d.job && d.schemaVersion === 'policy-impact-preview.v1' && current && limits && d.supportStatus !== 'unavailable';
  const permalink = localImpactLink(props.permalink), revise = localImpactLink(props.reviseUrl);
  return <section className="impact-view" aria-labelledby={heading}>
    <h1 id={heading}>See What Changes</h1><h2>{d.title}</h2>
    <p>Proposed {d.type === 'bill' ? 'bill' : 'constitutional amendment'} · {d.legalStatus}. Not adopted law. Constitutional amendments require the Article V process.</p>
    <p>Synthetic educational scenarios, not official forecasts or empirical causal proof. Advisory responses are not an election; revisions do not inherit votes.</p>
    <nav aria-label="Impact version navigation">{permalink && <a href={permalink}>Stable link to this comparison</a>}{revise && <a href={revise}>Revise</a>}</nav>
    <nav aria-label="Selected and prior impact versions"><ul>{props.versions.map(v => { const href = localImpactLink(v.href); return href ? <li key={v.versionId}><a href={href} aria-current={v.versionId === d.versionId ? 'page' : undefined}>{v.label}</a></li> : null; })}</ul></nav>
    <p>Baseline proposed version: {d.baseVersionId} → selected version: {d.versionId}. Baseline is publisher-declared, not verified current law.</p>
    <details><summary>Reproducibility metadata</summary><dl><dt>Proposal</dt><dd>{d.proposalId}</dd><dt>Legal diff SHA-256</dt><dd>{d.contentHash}</dd><dt>Model / mapping version</dt><dd>{d.modelVersion ?? 'Unavailable'} / {d.mappingVersion ?? 'Unavailable'}</dd><dt>Requested simulation</dt><dd>Seed {d.simulation.seed} · {d.simulation.runs} paired runs · {d.simulation.months} months</dd></dl></details>
    <h2>Exact legal redline</h2>
    {d.clauses.map(c => <article key={c.clauseId}><h3>{c.clauseId} · {c.operation}</h3><div className="impact-redline"><div><h4>Before · {d.baseVersionId}</h4><pre>{c.beforeText ? <del>{c.beforeText}</del> : '(absent)'}</pre></div><div><h4>After · {d.versionId}</h4><pre>{c.afterText ? <ins>{c.afterText}</ins> : '(absent)'}</pre></div></div></article>)}
    <h2>Clause to reviewed mapping</h2><p>Support: {d.supportStatus}. Wording changes alone imply no numerical benefit. A reviewed software mapping is not a legal determination or empirical effect estimate.</p>
    <div className="impact-table" role="region" aria-label="Clause mappings and parameter changes" tabIndex={0}><table><caption>Legal wording and modeled mechanisms are separate</caption><thead><tr><th scope="col">Clause / mechanism</th><th scope="col">Reviewed parameter change</th><th scope="col">Assumptions and limitations</th></tr></thead><tbody>{d.clauses.map(c => {
      const mappings = d.mappings.filter(m => m.clauseId === c.clauseId);
      return <tr key={c.clauseId}><th scope="row">{c.clauseId} / {c.sourcePolicyId ?? 'No reviewed mapping'}</th><td>{mappings.length ? mappings.map((m, i) => <div key={i}>{m.parameter}: {m.before} → {m.after} {m.units}<p>{m.support} · mapping {m.mappingVersion}</p><p>{m.explanation}</p></div>) : 'Unavailable. No modeled effect inferred.'}</td><td>{mappings.map((m, i) => <div key={i}><p>Assumptions: {m.assumptions.join('; ') || 'Not supplied'}</p><p>Limitations: {m.limitations.join('; ') || 'Not supplied'}</p></div>)}</td></tr>;
    })}</tbody></table></div>
    <h2>Uncertainty</h2><ul>{d.uncertainties.length ? d.uncertainties.map((u, i) => <li key={i}>{u}</li>) : <li>Uncertainty data unavailable.</li>}</ul><p>Seed spread is not a calibrated probability forecast. Missing causal links remain unknown. Model upgrades or changed initial conditions can make prior previews incomparable.</p>
    <h2>HBL simulation</h2><p role="status" aria-live="polite">{!current ? (d.freshness === 'revised-source' ? 'Revised source: this preview belongs to an older immutable version. No current run is claimed.' : 'Stale status: refresh before treating this as current data.') : !limits ? 'Unavailable: HBL supports 1–100 paired runs and 1–24 months.' : d.job ? `Job: ${d.job.status}.` : 'No data: no run has been requested.'}{d.job && ` Completed pairs: ${d.job.completedPairs ?? 'unknown'}; failed pairs: ${d.job.failedPairs ?? 'unknown'}.`}</p>
    <p>Legal text and mapping disclosures remain available without HBL, an iframe or GPU. Partial and failed runs contain missing results; no completed outcome is substituted.</p>
    {usable && viewer && <p><a href={viewer} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open full simulator</a></p>}
    {usable && viewer && framing && d.job && !['failed', 'unavailable'].includes(d.job.status) ? <ImpactFrame key={identity} url={viewer} gpuAvailable={props.gpuAvailable} /> : <p>Embedded simulator unavailable. Exact approved Civic origin, supported public preview and current status are required.</p>}
  </section>;
}
function ImpactFrame({ url, gpuAvailable }: { url: string; gpuAvailable?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'failed'>(gpuAvailable === false ? 'failed' : 'idle');
  useEffect(() => {
    if (state !== 'loading') return;
    const failed = () => setState('failed');
    const element = frame.current;
    element?.addEventListener('error', failed);
    const timer = setTimeout(failed, 15000);
    return () => { clearTimeout(timer); element?.removeEventListener('error', failed); };
  }, [state]);
  return <div>
    {state === 'idle' && <button type="button" onClick={() => setState('loading')}>Load embedded simulator</button>}
    {state === 'loading' && <p role="status">Loading HBL frame… Legal text remains available.</p>}
    {['loading', 'loaded'].includes(state) && <iframe ref={frame} title="HBL Policy Impact Explorer: paired baseline and proposal" src={url} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={() => setState('loaded')} onError={() => setState('failed')} />}
    {state === 'failed' && <p role="status">Renderer or frame unavailable. Use the legal diff, mapping table or full simulator link.</p>}
    <p>Frame load does not verify model completion. If the viewer is blank, blocked or lacks GPU support, use the text above.</p>
    {['loading', 'loaded'].includes(state) && <button type="button" onClick={() => setState('failed')}>Use text fallback</button>}
  </div>;
}
