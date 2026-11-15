import { useEffect, useRef, useState } from 'react';

/** Fixed editorial script; speech reads these strings verbatim, never generates claims. */
export const BRIEFING_CHAPTERS = [
  { title: 'Proposal and scope', citation: 'Sample proposal clause 1', text: 'This is a fictional transit proposal in Civic Synthesis, not an adopted policy or a verified civic decision. The sample would fund a twelve month pilot of fifteen minute service through ten p.m. on three priority corridors, with quarterly public reporting. This briefing is an editorial example prepared by the Dear Congress prototype authors. The voice is synthetic. No agency has endorsed this script.' },
  { title: 'Reasons for', citation: 'Editorial argument: Reasons for; clause 1', text: 'The reason for this sample is that more frequent evening service could reduce waiting for riders whose shifts end late. This is an unverified assertion, not a measured benefit. No corridor specific ridership, staffing, or travel time study has been supplied. Frequency alone may not help if connections or reliability remain poor. Evidence that the proposed schedule does not improve access for evening riders would challenge this reason.' },
  { title: 'Concerns', citation: 'Editorial argument: Concerns; clause 1', text: 'The concern about this sample is that extra service could divert limited operating funds from other routes. This is an unverified assertion, not a measured cost. No operating budget or comparison with alternative service plans has been supplied. A time limited pilot with public reporting could reveal whether the added cost is justified. A funded operating plan without reductions to essential routes would address this concern.' },
  { title: 'Evidence and your choice', citation: 'Clause 1 and background reference below', text: 'Both perspectives receive equal space here; that does not establish equal evidence or editorial approval. The linked METRO homepage is agency background only. It does not substantiate either argument or document this fictional pilot. Costs, effects, and feasibility remain unknown. Read the clause and uncertainties before deciding. You can support, oppose, stay unsure, or simply read. Listening records no vote. Browser advisory choices are separate from fictional totals and never verify civic participation.' },
] as const;

type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'failed' | 'unavailable';
// Speech is a window-wide resource: stop the previous briefing before starting another.
let active: (() => void) | undefined;

export function AudioBriefing({ clauseId }: { clauseId: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [chapter, setChapter] = useState(0);
  const [rate, setRate] = useState(1);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const session = useRef(0);
  useEffect(() => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) setStatus('unavailable');
    const stopOnLeave = () => stopRef.current?.();
    window.addEventListener('pagehide', stopOnLeave);
    return () => { window.removeEventListener('pagehide', stopOnLeave); stopOnLeave(); };
  }, []);

  function start(index: number, speed = rate) {
    const speech = window.speechSynthesis;
    if (!speech || !window.SpeechSynthesisUtterance) { setStatus('unavailable'); return; }
    active?.();
    // Do not cancel unrelated assistive speech owned by another application.
    if (speech.speaking || speech.pending) { setStatus('failed'); return; }
    const token = ++session.current;
    let timer: ReturnType<typeof setTimeout>;
    const stop = () => {
      ++session.current;
      clearTimeout(timer);
      if (active === stop) { active = undefined; speech.cancel(); }
      stopRef.current = undefined;
      setStatus('idle');
    };
    active = stop;
    stopRef.current = stop;
    const fail = () => { if (token === session.current) { stop(); setStatus('failed'); } };
    function read(i: number) {
      if (token !== session.current) return;
      const part = BRIEFING_CHAPTERS[i];
      if (!part) { stop(); return; }
      setChapter(i); setStatus('loading');
      try {
      const utterance = new window.SpeechSynthesisUtterance(`${part.title}. ${part.text}`);
      utterance.lang = 'en-US'; utterance.rate = speed;
      timer = setTimeout(fail, 12000);
      utterance.onstart = () => { if (token === session.current) { clearTimeout(timer); setStatus('playing'); } };
      utterance.onerror = fail;
      utterance.onend = () => { if (token === session.current) { clearTimeout(timer); read(i + 1); } };
      speech.speak(utterance);
      } catch { fail(); }
    }
    read(index);
  }
  const busy = status === 'playing' || status === 'paused' || status === 'loading';
  return <section className="audio-briefing" aria-label="Two-minute demo briefing">
    <h4>Listen or read: about two minutes</h4>
    <p>Synthetic voice · fixed editorial script by Dear Congress prototype authors · fictional transit sample v1. Unreviewed editorial example; no agency endorsement. Duration varies by voice and speed.</p>
    <p>Your browser or device speech service reads the exact transcript below on request; voice availability and processing depend on your browser. No audio is required to decide.</p>
    <div className="briefing-controls">
      <button type="button" disabled={status === 'unavailable' || busy} onClick={() => start(0)}>Play briefing</button>
      <button type="button" disabled={status !== 'playing' && status !== 'paused'} onClick={() => {
        try {
          if (status === 'paused') { window.speechSynthesis.resume(); setStatus('playing'); }
          else { window.speechSynthesis.pause(); setStatus('paused'); }
        } catch { stopRef.current?.(); setStatus('failed'); }
      }}>{status === 'paused' ? 'Resume' : 'Pause'}</button>
      <button type="button" disabled={!busy} onClick={() => stopRef.current?.()}>Stop</button>
      <label>Speed <select value={rate} onChange={e => {
        const next = Number(e.target.value); setRate(next);
        if (busy) { stopRef.current?.(); setStatus('idle'); }
      }}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option></select></label>
    </div>
    <p role="status">{status === 'unavailable' ? 'Audio unavailable in this browser. Read the full transcript below.' : status === 'failed' ? 'Audio could not play. Read the transcript or retry Play briefing.' : status === 'loading' ? 'Loading synthetic voice…' : status === 'playing' ? `Playing: ${BRIEFING_CHAPTERS[chapter]!.title}` : status === 'paused' ? `Paused: ${BRIEFING_CHAPTERS[chapter]!.title}` : 'Ready. Speed changes stop playback; play again at the selected speed.'}</p>
    <h5>Full transcript and cited chapters</h5>
    {BRIEFING_CHAPTERS.map((part, i) => <section key={part.title} aria-label={part.title}>
      <h6>{i + 1}. {part.title}</h6><p>{part.text}</p>
      <p><a href={`#${clauseId}`} onClick={e => {
        const clause = e.currentTarget.ownerDocument.getElementById(clauseId);
        if (clause?.parentElement?.tagName === 'DETAILS') (clause.parentElement as HTMLDetailsElement).open = true;
      }}>{part.citation}</a> · <a href="https://www.ridemetro.org/" target="_blank" rel="noopener noreferrer">METRO — agency background only, freshness unknown</a></p>
      <button type="button" disabled={status === 'unavailable'} onClick={() => start(i)}>Listen from chapter {i + 1}</button>
    </section>)}
  </section>;
}
