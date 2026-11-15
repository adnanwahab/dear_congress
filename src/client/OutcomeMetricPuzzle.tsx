import { useEffect, useId, useRef, useState } from 'react';
import './outcome-metric-puzzle.css';

export const METRIC_STEPS = [
  { name: 'Denominator', prompt: 'Whose experience counts?', options: [
    ['All library requests, including abandoned requests', 'Includes people who gave up. Define duplicate requests and publish exclusions so the denominator cannot quietly shrink.'],
    ['Completed library requests only', 'Easy to count, but dropping difficult or abandoned requests can make results look better. Publish abandonment alongside completion.'],
  ] },
  { name: 'Measure', prompt: 'What observable target tests “faster service”?', options: [
    ['At least 90% served within 10 minutes', 'A threshold exposes long waits. Fix start/end timestamps and audit whether staff delay starting the clock.'],
    ['Average wait below 10 minutes', 'An average is practical but can hide very long waits. Publish the distribution and check whether hard requests are excluded.'],
  ] },
  { name: 'Timeframe', prompt: 'When will the target be evaluated?', options: [
    ['Next quarter against the same quarter last year', 'Seasonal comparison helps. Record opening hours and staffing changes; a comparison alone does not prove causation.'],
    ['Tomorrow against today', 'Fast feedback, but small samples and day-to-day variation make this a weak outcome test. Repeat over a longer period.'],
  ] },
  { name: 'Data source', prompt: 'What could an independent reviewer inspect?', options: [
    ['De-identified queue logs plus an independent sample audit', 'Document collection rules, missing timestamps, retention and audit access. Publish aggregates, never patron identities. The audit costs staff time.'],
    ['Optional satisfaction survey', 'Cheap and useful for experience, but response bias and missing wait timestamps limit this source. Pair it with queue observations.'],
  ] },
  { name: 'Failure criteria', prompt: 'What would prevent a success claim?', options: [
    ['Missed target or over 5% missing records means no success claim', 'Precommitting prevents moving the goalposts. Report a missed target as failure and excessive missingness as insufficient evidence; audit exclusions.'],
    ['Staff decide after seeing the results', 'Flexible, but invites cherry-picking. Publish a threshold and missing-data rule before collection begins.'],
  ] },
] as const;

export function OutcomeMetricPuzzle({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const choiceId = useId();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<(number | null)[]>(Array(5).fill(null));
  const heading = useRef<HTMLHeadingElement>(null);
  const launch = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (active) heading.current?.focus(); }, [active, step]);
  function close() { setActive(false); setStep(0); setChoices(Array(5).fill(null)); onActiveChange?.(false); launch.current?.focus(); }
  const scene = METRIC_STEPS[step];
  return <section className="outcome-metric-puzzle" aria-label="Outcome metric learning puzzle">
    <span className="workflow-source-status">Fictional / hypothetical · Local-only learning</span>
    <p>Design an outcome metric: turn “make library service faster” into an auditable target for the fictional town of Lantern Bay.</p>
    <p>No votes, submissions, rewards or political rankings. Choices stay in memory and disappear on exit or reload. Advisory participation is unchanged.</p>
    <button type="button" ref={launch} hidden={active} onClick={() => { setActive(true); onActiveChange?.(true); }}>Try the metric puzzle</button>
    {active && <>
      <h2 ref={heading} tabIndex={-1}>{scene ? `${step + 1} / 5 · ${scene.name}` : 'Your metric review'}</h2>
      <p>Fictional Lantern Bay library exercise · Hypothetical targets and sources, not measured results.</p>
      {scene ? <>
        <label htmlFor={choiceId}>{scene.prompt}</label>
        <select id={choiceId} data-metric-choice="true" value={choices[step] ?? ''} onChange={e => setChoices(previous => previous.map((v, i) => i === step ? Number(e.target.value) : v))}>
          <option value="" disabled>Choose a metric component</option>
          {scene.options.map(([label], i) => <option key={label} value={i}>{label}</option>)}
        </select>
        <p role="status">{choices[step] === null ? 'Choose an option, or skip this component.' : scene.options[choices[step]!]![1]}</p>
        <button type="button" disabled={choices[step] === null} onClick={() => setStep(step + 1)}>Continue</button>
        <button type="button" onClick={() => { setChoices(previous => previous.map((v, i) => i === step ? null : v)); setStep(step + 1); }}>Skip</button>
      </> : <>
        <p>Review practicality and opportunities to game the measurement. This is feedback, not a score or an endorsement.</p>
        <dl>{METRIC_STEPS.map((s, i) => <div key={s.name}><dt>{s.name}</dt><dd>{choices[i] === null ? 'Skipped — define this before making a success claim.' : <>{s.options[choices[i]!]![0]}<p>{s.options[choices[i]!]![1]}</p></>}</dd></div>)}</dl>
        <p>Before using a real target, pin the baseline, calculation, collection owner, audit access and missing-data rules. Check subgroup coverage and unintended effects. A better number alone does not show that a policy caused improvement.</p>
      </>}
      <button type="button" onClick={() => { setChoices(Array(5).fill(null)); setStep(0); heading.current?.focus(); }}>Restart</button>
      <button type="button" onClick={close}>Exit puzzle</button>
    </>}
    <details><summary>Complete-text explanation</summary>
      <p>Fictional exercise: Lantern Bay promises faster library service. Choose a denominator, measure, timeframe, data source and failure criteria, then review their practicality and gaming risks. Every path is available without a score or reward. Skip leaves a component undefined; Restart clears choices; Exit returns to the entry button. Use Tab to reach controls and native keyboard selection, or touch each control.</p>
      {METRIC_STEPS.map(s => <div key={s.name}><h3>{s.name}: {s.prompt}</h3>{s.options.map(([label, feedback]) => <p key={label}><strong>{label}.</strong> {feedback}</p>)}</div>)}
      <p>Define baseline, owner and audit access before real use. Report uncertainty, subgroup differences and unintended effects. These hypothetical sources are not official evidence. Nothing here changes advisory participation.</p>
    </details>
  </section>;
}
