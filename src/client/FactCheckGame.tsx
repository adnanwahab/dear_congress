import { useRef, useState } from 'react';

export const CLASSIFICATIONS = ['Claim', 'Inference', 'Uncertainty', 'Opinion'] as const;
type Classification = typeof CLASSIFICATIONS[number];
// Pinned editorial exercises; never derived from the selected proposal or its votes.
export const FACT_CHECK_SOURCE = {
  title: 'H.R. 3684 (117th Congress), enrolled text — Infrastructure Investment and Jobs Act',
  url: 'https://www.congress.gov/bill/117th-congress/house-bill/3684/text/enr',
  date: '2021-11-15',
  passage: 'Division J, Title II, National Telecommunications and Information Administration, Broadband Equity, Access, and Deployment Program',
  excerpt: '“$42,450,000,000, to remain available until expended”',
};
export const FACT_CHECK_EXERCISES: readonly { statement: string; classification: Classification; reasoning: string }[] = [
  { statement: 'The enrolled bill provides $42.45 billion for the Broadband Equity, Access, and Deployment Program.', classification: 'Claim', reasoning: 'This is a checkable statement directly supported by the appropriation. A claim can be supported or unsupported; the category alone does not mean true. Funding is not proof of completed connections.' },
  { statement: 'That funding could help expand broadband access.', classification: 'Inference', reasoning: 'This draws a possible consequence from the grant funding. The appropriation supports the premise, but does not establish the outcome. Implementation evidence would be needed.' },
  { statement: 'From this appropriation alone, we cannot tell how many households will actually get connected.', classification: 'Uncertainty', reasoning: 'This identifies a limit of the cited passage. The funding amount alone does not measure completed household connections; later deployment data would be needed.' },
  { statement: 'Expanding broadband is the best use of public money.', classification: 'Opinion', reasoning: '“Best” expresses a value judgment. The appropriation supplies context, but cannot establish this preference as a fact. People may weigh public priorities differently.' },
];

/** Local practice only: no transport, storage, score, or civic authority. */
export function FactCheckGame() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Classification | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const exercise = FACT_CHECK_EXERCISES[index]!;
  function move(next: number) {
    setIndex(next);
    setAnswer(null);
    heading.current?.focus();
  }
  return <section className="fact-check-game" aria-label="Fact-check detective practice">
    <h3>Fact-check detective</h3>
    <p>Practice only · not a vote or verified civic participation. Nothing is saved or counted. No political agreement is scored.</p>
    <p>Separate historical bill exercise: H.R. 3684 (117th Congress), enacted November 15, 2021. These examples are written for practice, not quotations by a participant or evidence for the fictional proposal above.</p>
    <details><summary>How to classify a statement</summary><dl>
      <dt>Claim</dt><dd>A checkable assertion; it still needs evidence.</dd>
      <dt>Inference</dt><dd>A conclusion drawn from evidence beyond what it directly says.</dd>
      <dt>Uncertainty</dt><dd>A gap or limit in what the evidence establishes.</dd>
      <dt>Opinion</dt><dd>A preference or value judgment.</dd>
    </dl><p>Statements can overlap. Here, choose the main role of each carefully worded example.</p></details>
    <h4 ref={heading} tabIndex={-1}>Case {index + 1} of {FACT_CHECK_EXERCISES.length}</h4>
    <blockquote>{exercise.statement}</blockquote>
    <fieldset><legend>What kind of statement is this?</legend>
      <div className="fact-check-choices">{CLASSIFICATIONS.map(category => <button type="button" key={category} aria-pressed={answer === category} disabled={answer !== null} onClick={() => setAnswer(category)}>{category}</button>)}</div>
    </fieldset>
    <div role="status" aria-live="polite" aria-atomic="true">{answer && <>
      <p>Your choice: {answer}. Teaching classification: <strong>{exercise.classification}</strong>.</p>
      <p>{exercise.reasoning}</p>
      <p>Publisher: Congress.gov / Library of Congress. Original source: <a href={FACT_CHECK_SOURCE.url} target="_blank" rel="noopener noreferrer">{FACT_CHECK_SOURCE.title} (opens a new tab)</a></p>
      <p>Enacted: <time dateTime={FACT_CHECK_SOURCE.date}>November 15, 2021</time> · Source passage checked November 14, 2026. Historical text, not current program results.</p>
      <p>Find in source: {FACT_CHECK_SOURCE.passage}.</p>
      <blockquote>{FACT_CHECK_SOURCE.excerpt}</blockquote>
      <p>If Congress.gov is unavailable, this bundled excerpt and locator remain available. Retry the source link later to inspect the full context.</p>
    </>}</div>
    {answer && <button type="button" onClick={() => move(index + 1 < FACT_CHECK_EXERCISES.length ? index + 1 : 0)}>{index + 1 < FACT_CHECK_EXERCISES.length ? 'Next case' : 'Practice again'}</button>}
    <p>No time limit. Reloading or leaving this proposal resets practice. Existing civic navigation and advisory voting remain separate.</p>
  </section>;
}
