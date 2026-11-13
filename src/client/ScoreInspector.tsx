import type { PackageResult } from "../engine/types";

/** Inspection only: opening this view never sends a synthesis request. */
export function ScoreInspector({ pkg }: { pkg: PackageResult }) {
  const audit = pkg.scoreAudit;
  if (!audit) return <p>Score arithmetic unavailable for this response.</p>;
  return <details className="why">
    <summary>Why this plan?</summary>
    <p>Advisory prototype · {audit.version}. Costs and catalog evidence are illustrative assumptions, not verified predictions. Support describes this response’s voices; simulated residents are not verified voters.</p>
    <p>Base score = sum(raw × weight ÷ divisor) − change penalty + rounding adjustment. Scores use Math.round(x × 1000) ÷ 1000. Display rounding is applied last; use the exact numeric inputs below to reproduce within 1e-9. Selected rank adds the published stability bonus.</p>
    <p>Fairness is an opposition proxy: clamp(1 − 2.5 × strong opposition), rounded to three decimals. It does not measure distributional fairness. Evidence uses the greater of catalog evidence and available impact, clamped to [0,1]. Missing measured impact defaults to zero in scoring; it is not verified zero impact. No confidence interval is available.</p>
    <p>Package spend ${pkg.totalCost}B / ${pkg.budget}B. Greedy selection also applies rights, support, per-need, stability, persistence and churn rules; score order alone does not determine inclusion. This view does not claim global optimality or a budget decision trace.</p>
    {audit.proposals.map((row) => <details key={row.id}>
      <summary>{row.title} · {row.status} · base {row.base.total.toFixed(3)}</summary>
      <p>{row.reason}. Cost: {row.costB === null ? "unavailable" : `$${row.costB}B`}. Selected rank: {row.selectedRank ?? "not selected"}. Stability bonus: {row.selectedStabilityBonus ?? "not applicable"}.</p>
      <p>Divisor: {row.base.weightDivisor} (sum of weights, or 1 when all zero). Change penalty: {row.base.changePenalty}. Rounding adjustment: {row.base.roundingAdjustment}.</p>
      <ul>{Object.entries(row.base.parts).map(([key, term]) => <li key={key}>{key}: {term.raw} × {term.weight} ÷ {row.base.weightDivisor} = {term.contribution}</li>)}</ul>
      <p>Catalog evidence: {row.evidenceInputs.catalog}. Measured impact: {row.evidenceInputs.measuredImpact ?? "unavailable"}.</p>
    </details>)}
    <details><summary>Exact arithmetic inputs (JSON)</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(audit, null, 2)}</pre></details>
  </details>;
}
