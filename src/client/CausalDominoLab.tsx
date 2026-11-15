import { useRef, useState } from 'react';
import './causal-domino.css';

export const DOMINO_CHAINS = [
  { title: 'More access', cards: ['Extend fictional library hours', 'Shift workers can visit after work', 'More residents use shared study space'], links: ['Hypothetical: assumes opening times were the barrier.', 'Hypothetical: assumes accessible transport and useful services.'], uncertainty: 'Transport barriers or low awareness could prevent this chain.' },
  { title: 'Resource pressure', cards: ['Extend fictional library hours', 'Staff cover more evening shifts', 'Daytime programs lose staff time'], links: ['Hypothetical: assumes no additional staff are hired.', 'Hypothetical: assumes a fixed staffing budget.'], uncertainty: 'New staffing funds or different schedules could prevent this chain.' },
] as const;

/** Educational fixtures only. No proposal identity, request callback or persisted state. */
export function CausalDominoLab({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [played, setPlayed] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const chain = DOMINO_CHAINS[branch]!;
  const valid = order.length === 3 && order.every((card, i) => card === i);
  function reset() { setOrder([]); setPlayed(false); }
  function exit() { setOpen(false); reset(); setBranch(0); launcher.current?.focus(); }
  return <section className="domino-lab" aria-label="Causal domino laboratory">
    <button ref={launcher} aria-expanded={open} onClick={() => { if (open) exit(); else { onOpen?.(); setOpen(true); } }}>Causal domino laboratory</button>
    {open && <div>
      <h2>One policy, competing possibilities</h2>
      <p><strong>Fictional / hypothetical learning scene.</strong> No causal proof or policy prediction. Your choices stay in page memory and never alter advisory participation. No scores or rewards.</p>
      <p>Arrange mechanisms by selecting cards in order. Remove the last card to revise. Both branches are plausible assumptions, not right political answers.</p>
      <div className="domino-controls" role="group" aria-label="Competing hypothetical chains">{DOMINO_CHAINS.map((c, i) => <button key={c.title} aria-pressed={branch === i} onClick={() => { setBranch(i); reset(); }}>{c.title}</button>)}</div>
      <h3>{chain.title} · Hypothetical</h3>
      <div className="domino-controls" role="group" aria-label="Mechanism cards">{[2, 0, 1].map(i => <button key={i} disabled={order.includes(i)} onClick={() => { setOrder([...order, i]); setPlayed(false); }}>{chain.cards[i]}</button>)}</div>
      <ol className={played ? 'domino-chain domino-played' : 'domino-chain'} aria-label="Your mechanism chain">{order.map((id, i) => <li key={id} style={{ animationDelay: `${i * 220}ms` }}>{chain.cards[id]}<br /><span className="source-chip">Hypothetical · authored learning fixture</span>{i > 0 && <p>{id === i && order[i - 1] === i - 1 ? chain.links[i - 1] : 'Unvalidated link: animation blocked. Inspect the explanation and revise.'}</p>}</li>)}</ol>
      <p role="status">{played ? 'Hypothetical chain played. Compare the competing chain; neither is validated causal proof.' : valid ? 'All links explicitly hypothetical. Ready to trigger.' : 'Choose policy → mechanism → secondary effect. Unvalidated arrangements cannot animate.'}</p>
      <div className="domino-controls"><button disabled={!order.length} onClick={() => { setOrder(order.slice(0, -1)); setPlayed(false); }}>Remove last card</button><button disabled={!valid || played} onClick={() => setPlayed(true)}>Trigger chain</button><button onClick={reset}>Restart</button><button onClick={exit}>Skip</button><button onClick={exit}>Exit</button></div>
      <details><summary>Complete text explanation</summary><p>All scenes and links are fictional hypotheses authored for this exercise. There are no empirical sources validating these links. Animation illustrates the chosen assumptions only; order alone cannot establish causation.</p>{DOMINO_CHAINS.map(c => <section key={c.title}><h3>{c.title} · Hypothetical</h3><ol>{c.cards.map((card, i) => <li key={card}>{card}{i > 0 && <p>{c.links[i - 1]}</p>}</li>)}</ol><p>{c.uncertainty}</p></section>)}<p>Compare local staffing budgets, opening-time surveys and transport access before evaluating any real policy. Confounders, implementation and missing evidence may change either outcome. No ideological choice earns a reward.</p></details>
    </div>}
  </section>;
}
