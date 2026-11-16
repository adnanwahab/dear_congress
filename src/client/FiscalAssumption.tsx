import { useState } from 'react';
import type { Proposal } from '../engine/types';

function amount(value: number) {
  return `about $${value.toLocaleString('en-US', { maximumSignificantDigits: 3 })}B / year`;
}

/** Local sensitivity arithmetic only; never changes proposal costs or synthesis inputs. */
export function FiscalAssumption({ proposal }: { proposal: Proposal }) {
  const [percent, setPercent] = useState(100);
  const known = proposal.costB !== null && Number.isFinite(proposal.costB) && proposal.costB >= 0;
  const baseline = known ? proposal.costB! : null;
  const modeled = baseline === null ? null : baseline * percent / 100;
  return <section className="fiscal-assumption" aria-label={`Fiscal assumption for ${proposal.title}`}>
    <p><b>Fiscal assumption · {baseline === null ? 'unknown' : amount(baseline)}</b>. Unit: USD billions per year. {proposal.jurisdiction}.</p>
    <p>{proposal.emergent ? 'Unreviewed citizen concept' : 'Illustrative catalog sample'} · {proposal.costEstimate ? `${proposal.costEstimate} model assumption` : 'Catalog assumption'}. Independent fiscal source and estimate date: unknown. A model assessment is not source verification.</p>
    <p>Uncertainty range: unknown. These are not appropriated dollars or exact predictions. Existing spending, incremental spending and one-time costs are unknown.</p>
    <label>Sensitivity for {proposal.title}: {percent}% of baseline
      <input type="range" min={0} max={200} step={10} value={percent} disabled={baseline === null}
        onChange={e => { const next = Number(e.target.value); if (Number.isFinite(next) && next >= 0 && next <= 200) setPercent(next); }} />
    </label>
    <p role="status" aria-live="polite">{modeled === null ? 'Sensitivity unavailable: baseline cost unknown.' : `Local modeled cost: ${amount(modeled)}; delta ${modeled >= baseline! ? '+' : '−'}${amount(Math.abs(modeled - baseline!))}.`}</p>
    <p>The 0–200% control is an exploratory multiplier, not an evidence-backed range or confidence interval. It changes only this local display; package totals, selections, votes and saved records stay as calculated. Policy effects and interactions are not recalculated.</p>
    <button disabled={percent === 100} onClick={() => setPercent(100)}>Reset fiscal sensitivity</button>
  </section>;
}
