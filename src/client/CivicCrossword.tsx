import { useRef, useState } from 'react';
import './civic-crossword.css';

// Fixed editorial pack v1. No runtime generation or participation dependencies.
export const CLUES = [
  { id: '1-across', answer: 'SENATE', cells: [0,1,2,3,4,5], clue: 'The chamber of Congress with two members from each state.', definition: 'Senate: one of the two chambers of the United States Congress; each state has two senators.', source: 'U.S. Senate', url: 'https://www.senate.gov/about/origins-foundations/senate-and-constitution.htm' },
  { id: '2-down', answer: 'ACT', cells: [3,9,15], clue: 'A bill that has become law is called an ___.', definition: 'Act: legislation that has passed the required legislative process and become law.', source: 'Congress.gov', url: 'https://www.congress.gov/help/legislative-glossary' },
  { id: '3-across', answer: 'TAX', cells: [15,16,17], clue: 'A compulsory payment to government, often used to fund public services.', definition: 'Tax: a compulsory payment imposed by government. This puzzle makes no recommendation about tax policy.', source: 'IRS', url: 'https://apps.irs.gov/app/understandingTaxes/student/glossary.jsp' },
] as const;
export const CROSSWORD_CELLS: number[] = [...new Set(CLUES.flatMap(c => [...c.cells]))].sort((a,b) => a-b);
export function CivicCrossword() {
  const [open, setOpen] = useState(false);
  const [letters, setLetters] = useState<Record<number,string>>({});
  const [message, setMessage] = useState('');
  const launch = useRef<HTMLButtonElement>(null);
  const inputs = useRef<Record<number,HTMLInputElement | null>>({});
  const close = () => { setOpen(false); setLetters({}); setMessage(''); launch.current?.focus(); };
  const focus = (cell: number) => { inputs.current[cell]?.focus(); inputs.current[cell]?.select(); };
  const complete = CLUES.every(c => c.cells.map(n => letters[n] ?? '').join('') === c.answer);
  return <section className="civic-crossword" aria-label="Optional civic crossword">
    <button ref={launch} onClick={() => setOpen(true)}>Play Civic Chronicle crossword</button>
    {open && <div onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <h2>Civic Chronicle · Pack 1</h2>
      <p>Fictional learning scene: a hypothetical library editor is preparing a civic vocabulary chronicle. No signup, scores, rewards or ideological choices. Play never alters advisory participation, votes, proposals or records.</p>
      <p>Works offline after this page loads; references need internet. Progress stays in page memory and clears on exit or reload.</p>
      <p id="crossword-help">Type one letter per square. Tab visits squares and controls. Arrow keys move to the next square in that direction. Backspace clears; Escape exits. Touch a square to type, or use Hint.</p>
      <div className="crossword-grid" aria-label="Three-row, six-column crossword" aria-describedby="crossword-help">
        {Array.from({length:18}, (_,n) => CROSSWORD_CELLS.includes(n) ? <label key={n}>
          <span>{n === 0 ? '1' : n === 3 ? '2' : n === 15 ? '3' : '\u00a0'}</span>
          <input ref={el => { inputs.current[n] = el; }} aria-label={`Row ${Math.floor(n/6)+1}, column ${n%6+1}`} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={1} value={letters[n] ?? ''}
            onChange={e => setLetters(old => ({...old, [n]: e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(-1)}))}
            onKeyDown={e => {
              const delta = ({ArrowLeft:-1,ArrowRight:1,ArrowUp:-6,ArrowDown:6} as Record<string,number>)[e.key];
              if (!delta) return;
              e.preventDefault();
              let next = n + delta;
              while (next >= 0 && next < 18 && (Math.abs(delta) === 6 || Math.floor(next/6) === Math.floor(n/6))) {
                if (CROSSWORD_CELLS.includes(next)) { focus(next); break; }
                next += delta;
              }
            }} />
        </label> : <span className="crossword-block" key={n} aria-hidden="true" />)}
      </div>
      <ol>{CLUES.map(c => <li key={c.id}><strong>{c.id.replace('-', ' ')} ({c.answer.length})</strong>: {c.clue} <a href={`#crossword-${c.id}`} onClick={e => { const details = e.currentTarget.closest('.civic-crossword')?.querySelector('details'); if (details) details.open = true; }}>Glossary explanation</a> <button onClick={() => {
        const index = c.cells.findIndex((n,i) => letters[n] !== c.answer[i]);
        if (index < 0) { setMessage('This answer is already complete.'); return; }
        const cell = c.cells[index]!;
        setLetters(old => ({...old,[cell]: c.answer[index]!})); setMessage(`Hint placed for ${c.id}.`); focus(cell);
      }}>Hint {c.id}</button></li>)}</ol>
      <p role="status">{complete ? 'Puzzle complete! Explore the explanations below.' : message || 'Fill the three connected answers at your own pace.'}</p>
      <button onClick={() => setMessage('Some squares are empty or incorrect. Try a hint or read the complete explanation.')}>Check answers</button>{' '}
      <button onClick={() => { setLetters({}); setMessage('Restarted.'); focus(0); }}>Restart</button>{' '}
      <button onClick={close}>Skip</button>{' '}<button onClick={close}>Exit crossword</button>
      <details><summary>Complete-text explanation and answers</summary>
        <p>The hypothetical editor learns three neutral vocabulary terms. Across row 1 is SENATE; ACT runs down column 4; TAX runs across row 3, columns 4–6. Shared squares contain A and T. Completion confers no civic authority or participation credit.</p>
        {CLUES.map(c => <article key={c.id} id={`crossword-${c.id}`}><h3>{c.id}: {c.answer}</h3><p>{c.definition}</p><a className="crossword-source" href={c.url}>{c.source} · Source institution</a></article>)}
      </details>
    </div>}
  </section>;
}
