import { useEffect, useRef, useState } from 'react';
import { STAGES } from '../shared/civic-stages';
import type { TriviaTopic } from './civic-trivia';
type Bank = typeof import('./civic-trivia');
const loadBank = () => import('./civic-trivia');
export default function CivicTrivia({ load = loadBank }: { load?: () => Promise<Bank> }) {
  const [topics, setTopics] = useState<readonly TriviaTopic[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setFailed(false);
    load().then(bank => { bank.validateTopics(bank.TRIVIA_TOPICS); if (active) setTopics(bank.TRIVIA_TOPICS); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [load, attempt]);
  const topic = topics?.[round % topics.length];
  const question = topic?.questions[answers.length];
  const complete = !!topic && !question;
  function next() {
    setAnswers(previous => [...previous, choice!]); setChoice(null); setRevealed(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function clear(nextTopic: boolean) {
    setAnswers([]); setChoice(null); setRevealed(false); if (nextTopic) setRound(r => r + 1);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return <section id="civic-trivia" className="civic-trivia" aria-labelledby="trivia-heading">
    <h2 id="trivia-heading" ref={heading} tabIndex={-1}>Civic trivia arcade</h2>
    <p>Practice only · Houston, Texas. Five knowledge questions, no timer and no political stance score.</p>
    <p>Private progress stays in this page’s memory and disappears on reload or leaving this page. No answers are sent or saved. Gameplay never changes a real vote, public opinion weight, proposal or merge decision. Source links open external sites only when you follow them.</p>
    {!topic && !failed && <p role="status">Loading questions…</p>}
    {failed && <div role="alert"><p>Questions could not load. Your civic records are unaffected.</p><button onClick={() => setAttempt(n => n + 1)}>Retry questions</button></div>}
    {topic && <>
      <p>{topic.title} · {complete ? 'Round complete' : `Question ${answers.length + 1} of 5`}</p>
      {question && <>
        <fieldset disabled={revealed}><legend>{question.prompt}</legend>{question.choices.map((text, index) => <label key={text}><input type="radio" name="trivia-answer" checked={choice === index} onChange={() => setChoice(index)} /> {text}</label>)}</fieldset>
        {!revealed ? <button disabled={choice === null} onClick={() => setRevealed(true)}>Check answer</button> : <>
          <div role="status"><p><strong>{choice === question.answer ? 'Correct.' : 'Keep learning.'} Answer: {question.choices[question.answer]}</strong></p><p>{question.explanation}</p><p>Source: <a href={question.source.url}>{question.source.title}</a> · checked November 14, 2026. Official information can change.</p><p>Explore stage {STAGES[question.stage].n}: <a href={STAGES[question.stage].route}>{STAGES[question.stage].title}</a>. App examples are simulated; this link does not submit anything.</p></div>
          <button onClick={next}>{answers.length === 4 ? 'Finish round' : 'Next question'}</button>
        </>}
      </>}
      {complete && <div role="status"><p>You answered {answers.filter((answer, i) => answer === topic.questions[i]!.answer).length} of 5 correctly. This measures this practice round only.</p><button onClick={() => clear(true)}>Play next topic</button></div>}
      <button className="outline" onClick={() => clear(false)}>Clear private progress</button>
    </>}
  </section>;
}
