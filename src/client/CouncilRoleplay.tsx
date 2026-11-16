import { useEffect, useState } from 'react';

export const COUNCIL_ROLES = {
  Chair: 'Keep speaking time fair and explain whose needs remain unresolved.',
  'Budget officer': 'Keep the fictional $100,000 pilot within its limit and ask about ongoing costs.',
  Parent: 'Seek safer school crossings while accounting for families with different schedules.',
  'Transit user': 'Seek reliable evening buses for people who cannot drive.',
};
export const COUNCIL_ROUNDS = [
  { title: 'Open the meeting', speaker: 'Chair', text: 'Welcome to fictional Willow City. We have $100,000 for a one-year transport pilot. Crossings cost $70,000; evening buses cost $80,000. We cannot fully fund both. What responsibility would you bring to the meeting?', choices: ['Listen for safety needs', 'Listen for access needs'] },
  { title: 'Check the constraints', speaker: 'Budget officer', text: 'A smaller crossing pilot costs $50,000 and a smaller bus pilot costs $50,000. Splitting the funds reaches fewer streets and runs fewer services. These invented costs are teaching examples, not estimates. What should we check first?', choices: ['Ask about maintenance costs', 'Ask who a smaller pilot misses'] },
  { title: 'Hear the parent', speaker: 'Parent', text: 'My child crosses a busy road. I want safer crossings, but some parents work evenings and depend on the bus. What would you ask me?', choices: ['Which crossings pose the greatest risk?', 'How do evening shifts affect families?'] },
  { title: 'Hear the transit user', speaker: 'Transit user', text: 'I miss evening appointments when the bus stops early. A smaller pilot may still leave my neighborhood out. What would you ask me?', choices: ['Which trips have no alternative?', 'How could we check who is left out?'] },
  { title: 'Deliberate and reflect', speaker: 'Chair', text: 'A split pilot spreads support but limits coverage. Funding one service concentrates help and leaves another need unmet. Which practice recommendation would you explain, and what would make you reconsider it?', choices: ['Split funding and review unmet needs', 'Prioritize crossings and revisit transit', 'Prioritize buses and revisit crossings'] },
] as const;

export function CouncilRoleplay() {
  const [started, setStarted] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(true);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const roundIndex = Math.min(4, Math.floor(seconds / 60));
  const round = COUNCIL_ROUNDS[roundIndex]!;
  const complete = seconds >= 300;
  useEffect(() => {
    if (!started || paused || complete || skipped) return;
    const timer = window.setInterval(() => setSeconds(s => Math.min(300, s + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [started, paused, complete, skipped]);
  function restart() { setStarted(true); setSkipped(false); setSeconds(0); setAnswers({}); setPaused(true); }
  return <section className="panel council-roleplay" aria-labelledby="council-title">
    <span className="pill info">Sandbox demo · awaiting review</span>
    <h2 id="council-title">Practice a fictional city council meeting</h2>
    <p>About 5 minutes, at your pace. All personas, responses, places and costs are fictional, scripted teaching examples. No account needed. Choices stay in page memory and disappear on reload. Nothing casts a vote, creates a civic record or runs a model projection.</p>
    <p>Use Tab / Shift+Tab to reach controls and Enter / Space to activate them. There is no animation or audio. Pause anytime; use Next to move faster.</p>
    <details><summary>Fictional role descriptions</summary><dl>{Object.entries(COUNCIL_ROLES).map(([name, description]) => <div key={name}><dt><strong>{name} · fictional</strong></dt><dd>{description}</dd></div>)}</dl></details>
    {!started && !skipped && <button onClick={() => { setStarted(true); setPaused(false); }}>Start 5-minute scenario</button>}
    {!skipped && started && <>
      <p role="status">{complete ? 'Practice complete. Review your choices in the transcript.' : `Round ${roundIndex + 1} of 5 · ${paused ? 'Paused' : 'Running'}`}</p>
      <p>Elapsed: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 5:00</p>
      {complete && <p>Fictional chair: No option meets every responsibility. Explain the trade-off, check who was missed and set a review date. This practice recommendation has no official effect.</p>}
      {!complete && <><h3>{round.title}</h3><p><strong>{round.speaker} · fictional scripted response:</strong> {round.text}</p>
        <fieldset><legend>Your practice response · no correct answer</legend>{round.choices.map(choice => <label key={choice} className="council-choice"><input type="radio" name={`council-round-${roundIndex}`} checked={answers[roundIndex] === choice} onChange={() => { setAnswers(a => ({ ...a, [roundIndex]: choice })); setPaused(true); }} /> {choice}</label>)}</fieldset>
        {answers[roundIndex] && <p>Fictional chair: Thank you. Which responsibility does that serve, and whose need remains unmet? The meeting is paused for reflection.</p>}
        <div className="council-controls"><button onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</button><button disabled={roundIndex === 0} onClick={() => { setSeconds((roundIndex - 1) * 60); setPaused(true); }}>Previous round</button><button onClick={() => { setSeconds((roundIndex + 1) * 60); setPaused(true); }}>{roundIndex === 4 ? 'Finish practice' : 'Next round'}</button></div>
      </>}
    </>}
    {skipped && <p role="status">Scenario skipped. You can still read the full fictional transcript or restart.</p>}
    <div className="council-controls">{!skipped && <button className="outline" onClick={() => { setSkipped(true); setPaused(true); }}>Skip scenario</button>}<button className="outline" onClick={restart}>Restart scenario (paused)</button></div>
    <details><summary>Full fictional transcript (all rounds and response options)</summary>
      <p>Static script, not generated testimony. Your selected practice responses are shown separately.</p>
      {COUNCIL_ROUNDS.map((r, i) => <article key={r.title}><h3>{i + 1}. {r.title}</h3><p><strong>{r.speaker} · fictional:</strong> {r.text}</p><ul>{r.choices.map(c => <li key={c}>{c}</li>)}</ul><p>Your practice response: {answers[i] ?? 'None selected'}</p><p>Fictional chair after any response: Thank you. Which responsibility does that serve, and whose need remains unmet? The meeting is paused for reflection.</p></article>)}
      <p>Closing fictional chair: No option meets every responsibility. Explain the trade-off, check who was missed and set a review date. This practice recommendation has no official effect.</p>
    </details>
  </section>;
}
