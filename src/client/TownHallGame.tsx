import { useEffect, useRef, useState } from 'react';
import './town-hall-game.css';

import { HALL_SCENES } from './town-hall-scenes';
export { HALL_SCENES } from './town-hall-scenes';

export function TownHallGame() {
  const [step, setStep] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const previous = useRef(step);
  useEffect(() => {
    if (step !== null) heading.current?.focus();
    else if (previous.current !== null) start.current?.focus();
    previous.current = step;
  }, [step, choice]);
  const restart = () => { setAnswers([]); setChoice(null); setStep(0); heading.current?.focus(); };
  const next = (answer: number | null) => { setAnswers(a => [...a, answer]); setChoice(null); setStep(s => (s ?? 0) + 1); };
  const scene = step === null ? null : HALL_SCENES[step];
  return <section id="townhall" className="town-hall-game" aria-label="Read the room practice game">
    <span className="workflow-source-status badge">Fictional / hypothetical · Local practice</span>
    <h2>Read the room</h2>
    <p>Opt-in town-hall facilitation practice. Every speaker, question and time slot is fictional. Nothing here alters advisory participation, votes or public records. Progress lives only in page memory and disappears on exit or reload.</p>
    {step === null ? <button ref={start} type="button" onClick={restart}>Start town-hall practice</button> : <>
      <div className="town-hall-actions"><button type="button" onClick={restart}>Restart</button><button type="button" onClick={() => { setStep(null); setAnswers([]); setChoice(null); }}>Exit practice</button></div>
      <h3 tabIndex={-1} ref={heading}>{scene ? `Fictional scene ${step + 1} of ${HALL_SCENES.length}: ${scene.title}` : 'Practice complete'}</h3>
      {scene ? <>
        <p><strong>Hypothetical time budget: {scene.time}</strong> · No countdown; take as long as you need.</p>
        <ol aria-label="Simulated speaker queue">{scene.queue.map(q => <li key={q}>{q}</li>)}</ol>
        {choice === null ? <div className="town-hall-choices">{scene.choices.map(([label], i) => <button type="button" key={label} onClick={() => setChoice(i)}>{label}</button>)}</div> : <div role="status"><p>{scene.choices[choice]![1]}</p><button type="button" onClick={() => next(choice)}>Next scene</button></div>}
        <button type="button" onClick={() => next(null)}>Skip scene</button>
      </> : <><p>{answers.filter((a, i) => a !== null && HALL_SCENES[i]?.choices[a]?.[2]).length} of {HALL_SCENES.length} opportunities practiced for fairness and listening. {answers.filter(a => a === null).length} skipped. No reward depends on ideology or agreement with a political stance.</p><ol>{HALL_SCENES.map((s, i) => <li key={s.title}>{s.title}: {answers[i] === null ? 'Skipped — explanation available below.' : s.choices[answers[i]!]![1]}</li>)}</ol></>}
    </>}
    <details><summary>Complete text explanation (all scenes and feedback)</summary><p>You are a fictional facilitator, not a participant choosing a policy. Practice first-turn access, time accommodations, consistent moderation, checking understanding and accurate follow-up. There is no timer, winning political stance, saved score or participation credit. Skip leaves a scene unscored; Restart clears this run; Exit clears all game state.</p>{HALL_SCENES.map(s => <section key={s.title}><h3>Fictional: {s.title}</h3><p>{s.time}</p><ul>{s.queue.map(q => <li key={q}>{q}</li>)}</ul>{s.choices.map(([label, feedback, fair]) => <p key={label}><strong>{label}</strong> {feedback} {fair ? 'Practices fairness and listening.' : 'Opportunity to improve procedure.'}</p>)}</section>)}</details>
  </section>;
}
