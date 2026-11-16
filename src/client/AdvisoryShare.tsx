import { useEffect, useState } from 'react';
import { decisionCard } from './advisory-share';
import { RESPONSIBLE_SHARING } from './responsible-sharing';

type Card = Awaited<ReturnType<typeof decisionCard>>;
export function AdvisoryShare({ id, choice }: { id: string; choice?: number }) {
  const [open, setOpen] = useState(false);
  const [includeStance, setIncludeStance] = useState(false);
  const [result, setResult] = useState<{ key: string; card: Card }>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const stance = includeStance ? choice : undefined;
  const key = JSON.stringify([id, stance]);
  const card = result?.key === key ? result.card : undefined;
  useEffect(() => {
    if (!open) return;
    let active = true;
    setResult(undefined); setError(false);
    decisionCard(id, stance).then(result => { if (active) setResult({ key, card: result }); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [open, id, stance, attempt]);
  function close() { setOpen(false); setIncludeStance(false); setResult(undefined); }
  return <section className="advisory-share" aria-label="Share advisory decision card">
    <button type="button" className="outline" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>Share preview</button>
    <details className="responsible-sharing">
      <summary>How to share responsibly</summary>
      <p>{RESPONSIBLE_SHARING}</p>
      <a href="/documentation#how-to-share-responsibly">Full sharing documentation</a>
    </details>
    {open && <div>
      <p>Review before downloading. Only this public fictional scenario and its background references are shared. Identity, journals and vote receipt identifiers are excluded.</p>
      <label><input type="checkbox" checked={includeStance} disabled={choice === undefined} onChange={event => { setResult(undefined); setIncludeStance(event.target.checked); }} /> Include my chosen stance (optional, off by default)</label>
      {choice === undefined && <p>No chosen stance available. You can share without choosing one.</p>}
      {error ? <div role="alert">Share preview unavailable. <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry preview</button></div> : !card ? <p role="status">Preparing share preview…</p> : <>
        <img className="advisory-share-image" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.svg)}`} alt={card.text} />
        <label>Alt text (copy with your graphic)<textarea readOnly value={card.text} /></label>
        <a className="dashboard-button" download="advisory-decision.svg" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.svg)}`}>Download advisory card (SVG)</a>
      </>}
    </div>}
  </section>;
}
