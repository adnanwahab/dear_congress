import { useEffect, useId, useRef, useState } from 'react';
import './chart-challenge.css';

type Row = { label: string; count: number; total: number };
type Scene = { title: string; claim: string; flaw: string; explanation: string; question: string; rows: Row[]; shown: number[]; baseline: number; unit: string };
export const CHART_SCENES: Scene[] = [
  { title: 'The towering increase', claim: '“Library visits nearly doubled!”', flaw: 'Truncated axis', question: 'Where does the axis begin?',
    explanation: 'The illustrative chart starts at 90 visits, making 100 and 110 look like a doubling (bars of 10 and 20). The actual increase is 10 visits, or 10% of 100. A zero baseline shows the relative sizes honestly.',
    rows: [{ label: 'Week A', count: 100, total: 1 }, { label: 'Week B', count: 110, total: 1 }], shown: [100, 110], baseline: 90, unit: 'visits' },
  { title: 'More responses, less context', claim: '“Workshop completion improved!”', flaw: 'Denominator shift', question: 'Out of how many participants?',
    explanation: 'Completions rise from 40 to 60, but participants rise from 50 to 100. The completion rate falls from 80% to 60%, a drop of 20 percentage points. Counts and rates answer different questions; show both denominators before comparing.',
    rows: [{ label: 'Workshop A', count: 40, total: 50 }, { label: 'Workshop B', count: 60, total: 100 }], shown: [40, 60], baseline: 0, unit: 'completions' },
  { title: 'The missing visitors', claim: '“80% of visitors liked the exhibit!”', flaw: 'Selection bias', question: 'Who was left out?',
    explanation: 'Only gift-shop visitors were shown: 80 of 100 liked the exhibit (80%). Among 100 other visitors, 20 liked it (20%). Together, 100 of 200 liked it (50%). Including both fictional groups corrects this omission; it does not prove that any real survey represents all visitors.',
    rows: [{ label: 'Gift-shop visitors', count: 80, total: 100 }, { label: 'Other visitors', count: 20, total: 100 }, { label: 'All visitors', count: 100, total: 200 }], shown: [80], baseline: 0, unit: '% liking exhibit' },
];
const flaws = ['Truncated axis', 'Denominator shift', 'Selection bias'];
function Bars({ values, labels, baseline, unit }: { values: number[]; labels: string[]; baseline: number; unit: string }) {
  const max = Math.max(...values, baseline + 1);
  return <div className="chart-challenge-bars" role="img" aria-label={`Axis: ${baseline} to ${max} ${unit}. ${values.map((v, i) => `${labels[i]}: ${v} ${unit}`).join('; ')}`}>
    <p>Axis: {baseline}–{max} {unit}</p>
    {values.map((v, i) => <div key={labels[i]}><span>{labels[i]} · {v} {unit}</span><div className="chart-challenge-track"><div style={{ width: `${100 * (v - baseline) / (max - baseline)}%` }} /></div></div>)}
  </div>;
}
/** Educational state lives only in this mounted component. No identity, storage or API access. */
export function ChartChallenge({ onStart }: { onStart?: () => void }) {
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null), [revealed, setRevealed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const scene = CHART_SCENES[index];
  useEffect(() => { if (open) heading.current?.focus(); }, [open, index]);
  function reset() { setIndex(0); setAnswer(null); setRevealed(false); heading.current?.focus(); }
  function exit() { setOpen(false); reset(); trigger.current?.focus(); }
  return <section className="chart-challenge" data-chart-challenge aria-label="Fictional chart challenge">
    <button type="button" ref={trigger} aria-expanded={open} aria-controls={id} onClick={() => { if (open) exit(); else { onStart?.(); reset(); setOpen(true); } }}>Catch the misleading chart · {open ? 'Close' : 'Play (optional)'}</button>
    {open && <div id={id} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); exit(); } }}>
      <p><span className="chip workflow-source-status">Fictional / hypothetical · Source: invented learning fixtures</span></p>
      <p>Local-only practice. No votes, advisory participation, rewards or ideological choices. Exit anytime; nothing is saved.</p>
      <h2 ref={heading} tabIndex={-1}>{scene ? `${index + 1} / 3 · ${scene.title}` : 'Challenge complete'}</h2>
      {scene ? <>
        <p>Intentionally misleading illustrative claim: <strong>{scene.claim}</strong></p>
        <Bars values={scene.shown} labels={scene.rows.map(r => r.label)} baseline={scene.baseline} unit={scene.unit} />
        <fieldset><legend>What makes this chart misleading?</legend>{flaws.map(flaw => <button type="button" key={flaw} aria-pressed={answer === flaw} onClick={() => { setAnswer(flaw); setRevealed(true); }}>{flaw}</button>)}</fieldset>
        <button type="button" onClick={() => setRevealed(true)}>Reveal explanation</button>
        {revealed && <section aria-label="Chart correction"><p role="status">{answer ? answer === scene.flaw ? 'You spotted it. ' : 'Another framing issue to inspect: ' : ''}<strong>{scene.flaw}</strong></p><p>{scene.explanation}</p><h3>Corrected chart</h3>
          <Bars values={scene.rows.map(r => index === 0 ? r.count : 100 * r.count / r.total)} labels={scene.rows.map(r => r.label)} baseline={0} unit={index === 0 ? 'visits' : '%'} />
          <table><caption>Complete fictional numerical data</caption><thead><tr><th scope="col">Group</th><th scope="col">Count</th><th scope="col">{index === 0 ? 'Measure' : 'Denominator'}</th><th scope="col">{index === 0 ? 'Change' : 'Rate'}</th></tr></thead><tbody>{scene.rows.map((r, i) => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.count}</td><td>{index === 0 ? 'Visits' : r.total}</td><td>{index === 0 ? i === 0 ? 'Baseline' : '+10 (10%)' : `${100 * r.count / r.total}%`}</td></tr>)}</tbody></table>
        </section>}
        <details><summary>Complete text explanation (all scenes)</summary>{CHART_SCENES.map(s => <section key={s.title}><h3>{s.title} · {s.flaw}</h3><p>Fictional claim: {s.claim}</p><p>{s.explanation}</p><p>Ask: {s.question}</p></section>)}</details>
        <button type="button" onClick={() => { setIndex(i => i + 1); setAnswer(null); setRevealed(false); }}>{revealed ? 'Next scene' : 'Skip scene'}</button>
      </> : <p>Before trusting a chart, ask where the axis starts, what the denominator is, and who is missing. Thanks for exploring.</p>}
      <div className="chart-challenge-actions"><button type="button" onClick={reset}>Restart</button><button type="button" onClick={exit}>Exit challenge</button></div>
    </div>}
  </section>;
}
