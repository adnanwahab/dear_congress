import { useRef, useState } from 'react';
import './procurement-game.css';

export const PROCUREMENT_BIDS = [
  { name: 'Fictional Bid A', cost: 70, quality: 60, weeks: 4, note: 'Lowest price leaves 30 tokens for other needs, but durability falls below the published requirement.' },
  { name: 'Fictional Bid B', cost: 95, quality: 90, weeks: 8, note: 'Durable equipment stays within budget, but arrives two weeks after the public deadline.' },
  { name: 'Fictional Bid C', cost: 100, quality: 80, weeks: 6, note: 'Meets all three published requirements, but uses the entire budget and leaves no contingency.' },
] as const;
const requirements = 'Hypothetical town: buy library equipment with at most 100 fictional budget tokens, durability at least 80/100, and delivery within six weeks. Apply the same published criteria to every bid; disclose conflicts and give all bidders equal access to clarifications.';

/** Educational state exists only in this mounted component. No participation APIs or storage. */
export function ProcurementGame({ onStart }: { onStart?: () => void }) {
  const [scene, setScene] = useState<'closed' | 'brief' | 'bids' | 'result'>('closed');
  const [selected, setSelected] = useState<number | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  function close() { setScene('closed'); setSelected(null); requestAnimationFrame(() => launcher.current?.focus()); }
  function restart() { setSelected(null); setScene('brief'); }
  const bid = selected === null ? null : PROCUREMENT_BIDS[selected]!;
  return <section className="procurement-game" aria-label="Fictional procurement learning game">
    <span className="chip">Source: authored fictional learning fixture</span>
    <h2>Can the lowest bid meet the public need?</h2>
    <p>Optional educational game · Hypothetical throughout. No real vendors, endorsements or procurement outcomes. No rewards, votes or changes to advisory participation. Progress disappears on exit or reload.</p>
    {scene === 'closed' ? <button type="button" ref={launcher} onClick={() => { onStart?.(); restart(); }}>Play procurement game</button> : <>
      <p role="status">{scene === 'brief' ? 'Scene 1 of 3 · Fictional public brief' : scene === 'bids' ? 'Scene 2 of 3 · Fictional bids' : 'Scene 3 of 3 · Hypothetical review'}</p>
      <p>{requirements}</p>
      {scene === 'brief' && <button type="button" onClick={() => setScene('bids')}>Compare fictional bids</button>}
      {scene === 'bids' && <fieldset><legend>Choose a fictional bid to inspect its tradeoffs</legend>{PROCUREMENT_BIDS.map((b, i) => <label key={b.name}><input type="radio" name="fictional-procurement-bid" checked={selected === i} onChange={() => setSelected(i)} /> {b.name}: {b.cost} tokens · durability {b.quality}/100 · {b.weeks} weeks</label>)}<button type="button" disabled={selected === null} onClick={() => setScene('result')}>Review tradeoffs</button></fieldset>}
      {scene === 'result' && <div>{bid ? <><h3>{bid.name} · illustrative scorecard</h3><ul><li>Budget: {bid.cost <= 100 ? '1/1' : '0/1'} · {100 - bid.cost} tokens remaining</li><li>Quality: {bid.quality >= 80 ? '1/1 meets' : '0/1 below'} published durability threshold</li><li>Delivery: {bid.weeks <= 6 ? '1/1 on time' : '0/1 late'}</li><li>Fairness: not inferred from a bid selection. Equal information, consistent criteria and conflict review still need verification.</li></ul><p>{bid.note}</p></> : <p>Skipped without choosing a bid. There is no score or penalty.</p>}<p>This is a comparison against fictional requirements, not an award decision. No aggregate winner or ideological reward is assigned. In real procurement, applicable rules and independent review would govern any next step.</p></div>}
      <div className="procurement-actions"><button type="button" onClick={() => { setSelected(null); setScene('result'); }}>Skip</button><button type="button" onClick={restart}>Restart</button><button type="button" onClick={close}>Exit</button></div>
    </>}
    <details><summary>Complete text explanation (all scenes and outcomes)</summary><p>{requirements}</p>{PROCUREMENT_BIDS.map(b => <p key={b.name}><b>{b.name}</b>: {b.cost} tokens; durability {b.quality}/100; delivery {b.weeks} weeks. Budget 1/1; quality {b.quality >= 80 ? '1/1' : '0/1'}; delivery {b.weeks <= 6 ? '1/1' : '0/1'}. {b.note}</p>)}<p>Low price, quality and speed can conflict. Fairness is a process obligation, not a vendor attribute: publish criteria, share clarifications equally, disclose conflicts and document review. No choice proves fairness. Skip has no penalty; Restart clears the selection; Exit clears progress and returns to Play. This fictional exercise never submits participation or endorses a real vendor.</p></details>
  </section>;
}
