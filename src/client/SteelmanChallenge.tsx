import { useId, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { ProposalProvenance } from './ProposalProvenance';

const rubric = [
  ['Fidelity', 'Represent the source’s actual objection fairly, without caricature or implying agreement.'],
  ['Evidence', 'Connect a specific source passage to the objection and distinguish evidence from assumptions.'],
  ['Completeness', 'Explain the trade-off, who could be affected, and what evidence would weaken the objection.'],
] as const;

/** Local self-review only: never sends prose to an evaluator, simulator or vote API. */
export function SteelmanChallenge({ item }: { item: DemoItem }) {
  const id = useId();
  const [active, setActive] = useState(false);
  const [summary, setSummary] = useState('');
  const [source, setSource] = useState('');
  const [passage, setPassage] = useState('');
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  function clear() {
    setActive(false); setSummary(''); setSource(''); setPassage('');
    setChecks([false, false, false]); setReviewed(false); setError('');
  }
  return <section className="steelman-challenge" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>Steelman challenge · optional sandbox</h4>
    <p>Practice fair understanding, whether you support, oppose, or are unsure about this proposal. There is no agreement score or political profile.</p>
    <p>AI scoring is off. AI can misread context, miss evidence and reward fluent but inaccurate prose; it cannot certify fairness or truth. This pilot uses your self-review only. You can skip or clear it at any time.</p>
    {!active ? <button type="button" onClick={() => setActive(true)}>Try the challenge</button> : <>
      <p><strong>Selected fictional proposal:</strong> {item.title}</p>
      <blockquote>{item.proposedText}</blockquote>
      <ProposalProvenance item={item} compact />
      <p>Find an opposing case in a source you can inspect. The background link above does not substantiate the objection. No reviewed strongest case is available yet.</p>
      <label htmlFor={`${id}-summary`}>In your own words, explain the strongest opposing case you found</label>
      <textarea id={`${id}-summary`} maxLength={3000} value={summary} onInput={e => { setSummary(e.currentTarget.value); setReviewed(false); }} />
      <label htmlFor={`${id}-source`}>Source title, publisher, date if known, and URL or document locator</label>
      <textarea id={`${id}-source`} maxLength={1000} value={source} onInput={e => { setSource(e.currentTarget.value); setReviewed(false); }} />
      <label htmlFor={`${id}-passage`}>Short relevant passage or page reference, and how it supports the objection</label>
      <textarea id={`${id}-passage`} maxLength={2000} value={passage} onInput={e => { setPassage(e.currentTarget.value); setReviewed(false); }} />
      <fieldset><legend>Self-review rubric · check only what your response covers</legend>
        {rubric.map(([name, prompt], index) => <label key={name}><input type="checkbox" checked={checks[index]} onChange={e => { setChecks(checks.map((value, i) => i === index ? e.target.checked : value)); setReviewed(false); }} />{name}: {prompt}</label>)}
      </fieldset>
      <button type="button" onClick={() => {
        if (![summary, source, passage].every(value => value.trim())) {
          setError('Add a summary, source details, and a relevant passage or page reference before self-review.'); return;
        }
        setError(''); setReviewed(true);
      }}>Review my coverage</button>{' '}
      <button type="button" onClick={clear}>Clear and skip challenge</button>
      {error && <p role="alert">{error}</p>}
      {reviewed && <div role="status"><p>Practice complete — thank you for examining an opposing case. This recognizes the exercise, not agreement or verified accuracy.</p>
        <ul>{rubric.map(([name, prompt], i) => <li key={name}><strong>{name}:</strong> {checks[i] ? 'You marked this covered. Compare your wording with the original source to check.' : `Revisit: ${prompt}`}</li>)}</ul>
        <p>Source supplied, not verified. No automated fidelity assessment was performed; human review is still needed.</p>
      </div>}
    </>}
    <p>Your response stays in page memory and is lost when you leave or change proposal revision. Nothing is submitted, saved, or sent to AI. Stored votes and synthetic model projections are unchanged.</p>
  </section>;
}
