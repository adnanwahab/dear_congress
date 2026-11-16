import { useEffect, useId, useRef, useState } from 'react';
import './missing-voice.css';

export const voiceScenes = [
  {
    title: 'The lunchtime meeting',
    sample: 'Fictional consultation: A library asks about opening hours at a Tuesday noon meeting. All twelve attendees prefer daytime service.',
    choices: ['People unable to attend during work or care duties', 'Everyone already had an equal chance to respond'],
    explanation: 'Meeting attendance is self-selected. A noon meeting can miss people working or providing care; twelve responses cannot establish what all residents prefer. We cannot infer anyone’s preference from their schedule.',
    outreach: 'Offer evening and asynchronous responses, accessible venues and optional care support. Publish an open invitation through several channels; ask about access barriers voluntarily rather than collecting personal profiles.',
  },
  {
    title: 'The online survey',
    sample: 'Fictional consultation: A bus agency posts a survey only in its route-planning app. Responses ask for more express buses.',
    choices: ['People who do not use the app or cannot access it', 'The app responses prove all riders agree'],
    explanation: 'App users selected themselves into this sample. People without reliable internet, accessible devices or app access may be absent. Missing responses are not agreement or opposition, and app use does not predict a person’s views.',
    outreach: 'Offer paper, phone, translated and accessible versions with the same questions. Share open invitations at stops and through community organizations without tracking or inferring sensitive traits.',
  },
  {
    title: 'The enthusiastic mailing list',
    sample: 'Fictional consultation: A park friends mailing list receives a skate-area proposal. Twenty subscribers reply enthusiastically.',
    choices: ['Other park users and people affected by access or noise', 'Twenty enthusiastic replies represent the whole neighborhood'],
    explanation: 'Subscribers and respondents are two layers of self-selection. Other users, nearby residents and people who stopped visiting may have different experiences. Their actual views remain unknown; no group is a single viewpoint.',
    outreach: 'Invite feedback through multiple public channels and varied meeting times, asking everyone the same neutral questions. Explain sample limitations and remaining gaps. Never buy personal lists, infer ideology or treat broader outreach as a representative census.',
  },
];

/** Page-memory education only: deliberately receives no proposal, identity or mutation API. */
export function MissingVoice({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const choiceName = useId();
  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const current = voiceScenes[scene];
  useEffect(() => { if (open) heading.current?.focus(); }, [open, scene]);
  function toggle(value: boolean) {
    setOpen(value); onOpenChange?.(value);
    if (!value) launcher.current?.focus();
  }
  function restart() { setScene(0); setAnswer(null); setRevealed(false); heading.current?.focus(); }
  return <section className="missing-voice" aria-label="Spot the missing voice">
    <button type="button" ref={launcher} aria-expanded={open} onClick={() => { restart(); toggle(!open); }}>Spot the missing voice · Optional puzzle</button>
    {open && <div>
      <h2 tabIndex={-1} ref={heading}>{current ? `${scene + 1} / ${voiceScenes.length} · ${current.title}` : 'Reflection complete'}</h2>
      <p><span className="workflow-source-status">Fictional / hypothetical · Educational sample</span></p>
      <p>Local-only play. Nothing is submitted or saved; advisory participation is unchanged. No scores, rewards or ideological choices.</p>
      {current ? <>
        <p>{current.sample}</p>
        <fieldset><legend>Which perspective might be missing?</legend>{current.choices.map((choice, index) => <label key={choice}><input type="radio" name={choiceName} checked={answer === index} onChange={() => { setAnswer(index); setRevealed(false); }} />{choice}</label>)}</fieldset>
        <button type="button" disabled={answer === null} onClick={() => setRevealed(true)}>Reveal explanation</button>
        {revealed && <div role="status"><p>{current.explanation}</p><p>{current.outreach}</p></div>}
        <button type="button" onClick={() => { setScene(scene + 1); setAnswer(null); setRevealed(false); }}>{revealed ? 'Next scene' : 'Skip scene'}</button>
      </> : <p>A consultation describes those who responded. Broader outreach can reveal missing experiences, but does not by itself make a sample representative. Ask, do not presume.</p>}
      <details><summary>Complete text explanation · all scenes</summary>{voiceScenes.map(s => <article key={s.title}><h3>{s.title} · Fictional</h3><p>{s.sample}</p><p>{s.explanation}</p><p>{s.outreach}</p></article>)}</details>
      <div className="missing-voice-actions"><button type="button" onClick={restart}>Restart puzzle</button><button type="button" onClick={() => toggle(false)}>Exit puzzle</button></div>
    </div>}
  </section>;
}
