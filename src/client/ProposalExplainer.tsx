import { useEffect, useId, useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';

export interface ExplainerCue { heading: string; text: string; source: 'summary' | 'proposedText' | 'jurisdiction'; }
/** Describe supplied scenario text only; never turn background URLs into evidence. */
export function explainerCues(item: DemoItem): ExplainerCue[] | null {
  if (![item.summary, item.proposedText, item.jurisdiction].every(text => text.trim() && text.length < 650)) return null;
  return [
    { heading: 'Goal', text: `This is a fictional sample, not an introduced bill. The sample describes its goal as: ${item.summary}`, source: 'summary' },
    { heading: 'Proposed mechanism', text: `The proposed sample clause says: ${item.proposedText}`, source: 'proposedText' },
    { heading: 'Jurisdiction', text: `The scenario lists the jurisdiction as ${item.jurisdiction}. This is a scenario label, not verification of legal authority.`, source: 'jurisdiction' },
    { heading: 'Tradeoffs', text: 'The cited sample summary and clause are proposal descriptions, not evidence of benefits or costs. This explainer cannot establish the balance of tradeoffs from those descriptions.', source: 'proposedText' },
    { heading: 'Major uncertainty', text: 'The sample text does not establish what would happen in practice. Background agency links do not verify this proposal. Review evidence before choosing Support, Oppose, or Not sure; listening records no vote.', source: 'proposedText' },
  ];
}

export function ProposalExplainer({ item }: { item: DemoItem }) {
  const prefix = useId();
  const cues = explainerCues(item);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'failed' | 'done'>('idle');
  const [active, setActive] = useState<number | null>(null);
  const run = useRef(0);
  const owned = useRef(false);
  useEffect(() => () => {
    run.current++;
    if (owned.current) window.speechSynthesis?.cancel();
    owned.current = false;
  }, [item.id, item.summary, item.proposedText, item.jurisdiction]);
  function stop() {
    run.current++;
    if (owned.current) window.speechSynthesis?.cancel();
    owned.current = false;
    setActive(null); setState('idle');
  }
  function play() {
    if (!cues) return;
    const token = ++run.current;
    setState('loading'); setActive(null);
    try {
      const synth = window.speechSynthesis;
      if (!synth || !window.SpeechSynthesisUtterance || synth.speaking || synth.pending) throw new Error('Voice unavailable or busy');
      const speak = (index: number) => {
        if (run.current !== token) return;
        if (index === cues.length) { owned.current = false; setState('done'); setActive(null); return; }
        const utterance = new window.SpeechSynthesisUtterance(cues[index]!.text);
        utterance.lang = 'en-US'; utterance.rate = 1;
        utterance.onstart = () => { if (run.current === token) { setState('playing'); setActive(index); } };
        utterance.onend = () => speak(index + 1);
        utterance.onerror = () => { if (run.current === token) { owned.current = false; setState('failed'); setActive(null); } };
        owned.current = true;
        synth.speak(utterance);
      };
      speak(0);
    } catch { owned.current = false; setState('failed'); setActive(null); }
  }
  return <section className="proposal-explainer" aria-label="Proposal audio explainer">
    <h2>Listen to a proposal explainer</h2>
    <p>About 60 seconds; voice speed varies. Synthetic audio · fictional sample. Playback starts only when you press Play. Your browser or operating system provides the voice and may use its speech service.</p>
    {cues ? <>
      <button type="button" onClick={play} disabled={state === 'loading' || state === 'playing'}>Play explainer</button>{' '}
      <button type="button" onClick={stop} disabled={state !== 'loading' && state !== 'playing'}>Stop audio</button>
      <p role="status">{state === 'loading' ? 'Preparing voice… You can stop while waiting.' : state === 'playing' ? 'Playing synthetic audio' : state === 'done' ? 'Playback finished' : state === 'failed' ? 'Voice unavailable or interrupted. Read the transcript or try Play again.' : 'Audio is off. Transcript available below.'}</p>
      <div aria-label="Subtitles" aria-live="off"><strong>Subtitles: </strong>{active === null ? 'Current passage appears here during playback.' : cues[active]?.text}</div>
      <details><summary>Transcript and passage sources</summary><ol>{cues.map(cue => <li key={cue.heading}><strong>{cue.heading}</strong><p>{cue.text}</p><a href={`#${prefix}-${cue.source}`}>Source: sample {cue.source === 'proposedText' ? 'proposed clause' : cue.source}</a></li>)}</ol></details>
      <details><summary>Original sample text used for narration</summary>{(['summary', 'proposedText', 'jurisdiction'] as const).map(field => <p id={`${prefix}-${field}`} key={field}><strong>{field === 'proposedText' ? 'Proposed clause' : field}: </strong>{item[field]}</p>)}<small>Source identity: adnanwahab/dear_congress · fictional-demo · {item.id}. Narration is rebuilt from the displayed revision. These sources establish what the sample says, not real-world outcomes.</small></details>
    </> : <p role="status">No explainer available: the sample source text is missing or too long. Read the original proposal instead.</p>}
  </section>;
}
