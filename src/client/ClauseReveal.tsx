import { useId, useState, type CSSProperties } from 'react';
import { redline } from './amendment-drafts';
import './clause-reveal.css';

/** Read-only fictional comparison. Never interprets background references as law. */
export function ClauseReveal({ before, after }: { before: string; after: string }) {
  const id = useId();
  const [position, setPosition] = useState(50);
  const [sideBySide, setSideBySide] = useState(false);
  const diff = redline(before, after);
  const rows = [[diff.prefix, diff.prefix], [diff.removed, diff.added], [diff.suffix, diff.suffix]];
  return <section className="clause-reveal" aria-label="Fictional clause comparison">
    <p>Fictional demo text · current approach is illustrative, not quoted law. No imported official legal text is shown. Comparison does not publish or vote.</p>
    <button type="button" aria-pressed={sideBySide} onClick={() => setSideBySide(value => !value)}>Side-by-side mode</button>
    {!before && !after ? <p>No clause text available to compare.</p> : <>
      <p id={`${id}-help`}>Current approach on the left; proposed text on the right. Drag the slider or use arrow keys, Home and End. Removed and added spans are highlighted. Full selectable text and citations remain below.</p>
      <div className={sideBySide ? 'clause-lens clause-columns' : 'clause-lens'} style={{ '--reveal': `${position}%` } as CSSProperties} aria-hidden="true">
        <div className="clause-row clause-head"><strong>Current · illustrative</strong><strong>Proposed</strong></div>
        {rows.map(([current, proposed], index) => <div className="clause-row" key={index}>
          <div className="clause-current">{index === 1 ? <del>{current || '∅'}</del> : current}</div>
          <div className="clause-proposed">{index === 1 ? <ins>{proposed || '∅'}</ins> : proposed}</div>
        </div>)}
      </div>
      {!sideBySide && <label className="clause-slider" htmlFor={id}>Reveal boundary · {position}% current
        <input id={id} type="range" min="0" max="100" step="1" value={position} aria-describedby={`${id}-help`} aria-valuetext={`${position}% current approach, ${100 - position}% proposed text`} onChange={event => setPosition(Number(event.target.value))} />
      </label>}
    </>}
  </section>;
}
