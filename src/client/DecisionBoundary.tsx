import { useEffect, useId, useRef, useState } from 'react';
import type { RulePreview } from '../server/synthesis-rule-preview';
import { runViewTransition } from './motion';

type Package = RulePreview['packages'][number];
/** Distinct engine results only: equal rounded scores always cross together. */
export function boundaryScores(pkg: Package) {
  return [...new Set(pkg.options.map(option => option.candidateScore))].sort((a, b) => b - a);
}

export function DecisionBoundary({ pkg }: { pkg: Package }) {
  const label = useId();
  const scores = boundaryScores(pkg);
  const [position, setPosition] = useState(0);
  const active = useRef<ViewTransition | null>(null);
  const generation = useRef(0);
  const requested = useRef(0);
  useEffect(() => () => { generation.current++; active.current?.skipTransition(); }, []);
  const threshold = scores[position - 1];
  const rows = [...pkg.options].sort((a, b) => b.candidateScore - a.candidateScore || a.id.localeCompare(b.id));
  const count = rows.filter(row => threshold !== undefined && row.candidateScore >= threshold).length;
  const description = threshold === undefined ? 'Above the highest score: no policies highlighted' : `Score ≥ ${threshold.toFixed(3)}: ${count} policies highlighted`;
  function move(next: number) {
    requested.current = next;
    const revision = ++generation.current;
    active.current?.skipTransition();
    // Skipped snapshots or rapid input must never commit an older brush position.
    void runViewTransition(() => {
      if (revision === generation.current) setPosition(next);
    }, 'score-boundary', transition => { active.current = transition; }).catch(() => {
      if (revision === generation.current) setPosition(next);
    });
  }
  const name = `score-boundary-${Array.from(label, c => c.codePointAt(0)!.toString(16)).join('-')}`;
  return <section className="decision-boundary" aria-label={`${pkg.name} decision boundary`}>
    <h4>Decision boundary brush</h4>
    <p>Explore the candidate scores below in descending order. This visual threshold does not select a package or identify a causal weight tipping point. Actual inclusion changes are shown separately; budget, rights and stability constraints still apply.</p>
    <p>Engine rounding: change penalty = Math.round(λ × change level ÷ 6 × 1000) ÷ 1000; score = Math.round((weighted component sum ÷ weight sum − rounded penalty) × 1000) ÷ 1000. Equal rounded scores cross together. Threshold comparison is inclusive (≥).</p>
    <label htmlFor={label}>Sweep score boundary</label>
    <input id={label} type="range" min={0} max={scores.length} step={1} value={position} aria-valuetext={description} onChange={event => move(Number(event.target.value))} />
    <button type="button" onClick={() => move(requested.current >= scores.length ? 0 : requested.current + 1)}>Next score threshold</button>
    <p role="status" aria-live="polite">{description}</p>
    <style>{`html:is(:active-view-transition-type(score-boundary), [data-motion-type="score-boundary"])::view-transition-group(${name}) { animation-duration: var(--motion-plan); }
      html:is(:active-view-transition-type(score-boundary), [data-motion-type="score-boundary"])::view-transition-old(root), html:is(:active-view-transition-type(score-boundary), [data-motion-type="score-boundary"])::view-transition-new(root) { animation: none; }`}</style>
    <ol>
      {rows.map((row, index) => <li key={row.id} data-highlighted={threshold !== undefined && row.candidateScore >= threshold}>
        {index === count && <span className="score-brush" aria-hidden="true" style={{ viewTransitionName: name }} />}
        <b>{row.title}</b> · score {row.candidateScore.toFixed(3)} · {row.rightsBlocked ? 'Rights blocked' : row.baselineSelected === row.candidateSelected ? row.candidateSelected ? 'Retained in package' : 'Unselected in both' : row.candidateSelected ? 'Added to package' : 'Removed from package'}
      </li>)}
      {count === rows.length && <li className="score-brush-end"><span className="score-brush" aria-hidden="true" style={{ viewTransitionName: name }} />End of score list</li>}
    </ol>
  </section>;
}
