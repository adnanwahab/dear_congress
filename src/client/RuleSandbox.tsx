import { useEffect, useRef, useState } from 'react';
import type { Weights } from '../engine/types';
import type { RulePreview } from '../server/synthesis-rule-preview';
import { normalizeWeights, WEIGHT_KEYS } from '../shared/synthesis-rule';

type Request = <T>(path: string, body?: unknown) => Promise<T>;
export function RuleComparison({ preview }: { preview: RulePreview }) {
  return <div>
    <p>{preview.status}</p>
    <p>Inputs: {preview.fixture}. Fixed calculation date: {preview.fixtureTime}. Modeled score and selection effects are not measured personal welfare.</p>
    <p>Baseline: default weights, penalty 0.25, $40B budget. Candidate: penalty {preview.candidate.lambda}, ${preview.candidate.budget}B budget.</p>
    <p>Balanced uses normalized weights. Minimal change uses the same weights and penalty × 3 + 0.3. Most popular uses support alone and zero penalty. Rights constraints apply to all packages. Fairness is a score component; no hard fairness floor is configured.</p>
    {preview.packages.map(pkg => <details key={pkg.id}><summary>{pkg.name} · spend ${pkg.baseline.spend}B → ${pkg.candidate.spend}B</summary>
      <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={`${pkg.name} score comparison`}>
        <table><caption>{pkg.name}: baseline versus candidate. Scores precede stability and selection constraints.</caption>
          <thead><tr><th scope="col">Option</th><th scope="col">Baseline score</th><th scope="col">Candidate score</th><th scope="col">Score change</th><th scope="col">Selection effect</th></tr></thead>
          <tbody>{pkg.options.map(option => <tr key={option.id}><th scope="row">{option.title}</th><td>{option.baselineScore.toFixed(3)}</td><td>{option.candidateScore.toFixed(3)}</td><td>{option.delta > 0 ? '+' : ''}{option.delta.toFixed(3)}</td><td>{option.rightsBlocked ? 'Rights blocked' : option.baselineSelected === option.candidateSelected ? option.candidateSelected ? 'Retained' : 'Unselected in both' : option.candidateSelected ? 'Added' : 'Removed'}</td></tr>)}</tbody>
        </table>
      </div>
    </details>)}
  </div>;
}

export function RuleSandbox({ weights, lambda, budget, request }: { weights: Weights; lambda: number; budget: number; request: Request }) {
  const [preview, setPreview] = useState<RulePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current++; setPreview(null); setError(''); setBusy(false);
    return () => { sequence.current++; };
  }, [weights, lambda, budget]);
  let normalized: ReturnType<typeof normalizeWeights> | undefined;
  let validation = '';
  try { normalized = normalizeWeights(weights); } catch (e) { validation = (e as Error).message; }
  async function compare() {
    const id = ++sequence.current;
    setBusy(true); setError(''); setPreview(null);
    try {
      const result = await request<RulePreview>('/api/synthesis-rule-preview', { weights, lambda, budget });
      if (id === sequence.current) setPreview(result);
    } catch (e) { if (id === sequence.current) setError(e instanceof Error ? e.message : 'Preview unavailable. Try again.'); }
    finally { if (id === sequence.current) setBusy(false); }
  }
  return <section aria-label="Scoring rule sandbox">
    <h3>Scoring rule sandbox</h3>
    <p>These settings are experimental. Compare against the default rule using public fixtures before considering a pilot proposal.</p>
    {normalized ? <><p>Raw total: {normalized.total.toFixed(2)}. Each effective weight = raw weight ÷ raw total. Effective weights sum to 1 (display rounded).</p>
      <ul>{WEIGHT_KEYS.map(key => <li key={key}>{key}: {weights[key].toFixed(2)} ÷ {normalized.total.toFixed(2)} = {normalized.normalized[key].toFixed(4)}</li>)}</ul></> : <p role="alert">{validation}</p>}
    <p>Electorate, eligibility, quorum and grace period: not configured; approval is unavailable. Activation authority: no activation capability in this sandbox. Future activation requires explicit authorized maintainer action after verified approval.</p>
    <button type="button" disabled={busy || !normalized} onClick={() => void compare()}>Compare rule in sandbox</button>
    <p role="status" aria-live="polite">{busy ? 'Calculating fixture comparison…' : preview ? 'Fixture comparison ready.' : 'Changing settings clears the previous comparison.'}</p>
    {error && <p role="alert">{error} Retry with Compare rule in sandbox.</p>}
    {preview && <RuleComparison preview={preview} />}
  </section>;
}
