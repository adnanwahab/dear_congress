import { useEffect, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import type { DemoItem } from '../engine/demo';
import './patch-change.css';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Commit React's update inside the snapshot callback, rather than after it.
export function transitionProposal(update: () => void) {
  if (reducedMotion() || !document.startViewTransition) { update(); return; }
  const transition = document.startViewTransition(() => flushSync(update));
  // A skipped/interrupted visual transition must not produce an unhandled rejection.
  void transition.ready.catch(() => {});
}

export function PatchChange({ item }: { item: Pick<DemoItem, 'id' | 'currentText' | 'proposedText' | 'summary'> }) {
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const stop = () => setPlaying(false);
    preference?.addEventListener('change', stop);
    const timer = window.setTimeout(stop, 2600);
    return () => { window.clearTimeout(timer); preference?.removeEventListener('change', stop); };
  }, [playing, run]);
  const phrases = item.proposedText.match(/\S+(?:\s+\S+){0,3}\s*/g) ?? [item.proposedText];
  return <div className="patch-change" style={{ viewTransitionName: 'proposal-patch' }}>
    <button className="outline patch-play" onClick={() => {
      setPlaying(!reducedMotion()); setRun(n => n + 1);
    }}>Play the change <span aria-hidden="true">↻</span></button>
    <div key={run} className={playing ? 'patch-sequence is-playing' : 'patch-sequence'}>
      <h3 className="patch-label">Current approach · illustrative</h3>
      <div className="patch-code removed"><span className="patch-final">− {item.currentText}</span>{playing && <span className="patch-visual" aria-hidden="true">− <span className="patch-strike">{item.currentText}</span></span>}</div>
      <h3 className="patch-label">Proposed text</h3>
      <div className="patch-code added"><span className="patch-final">+ {item.proposedText}</span>{playing && <span className="patch-visual" aria-hidden="true">+ {phrases.map((phrase, index) => <span className="patch-phrase" key={index} style={{ '--phrase-delay': `${650 + index * 1450 / phrases.length}ms` } as CSSProperties}>{phrase}</span>)}</span>}</div>
      <h3 className="patch-label">Plain-English summary</h3>
      <p className="patch-summary">{item.summary}</p>
    </div>
  </div>;
}
