import { useId, useRef, useState } from 'react';
import { DEMO_ITEMS } from '../engine/demo';
import type { AmendmentSource } from './amendment-drafts';
import { runViewTransition } from './motion';

// Deliberately authored phrase mappings, never a generic legal-text paraphraser.
const readings = [
  ['one accessory dwelling', 'One additional home on the same lot. Eligibility and other restrictions still apply.'],
  ['7 percent of household income', 'Seven dollars for each hundred dollars of household income. How income is calculated is not specified here.'],
  ['twelve-month pilot', 'A trial lasting one year. This phrase does not promise a permanent service.'],
  ['quarterly public reporting', 'Reports made public every three months. The required contents are not specified here.'],
  ['risk-based drainage priority list', 'An ordering of drainage projects based on risk. The ranking formula is not specified here.'],
  ['known facility and clinician charges', 'Charges already known from the care location and the people providing care. This does not guarantee a final bill.'],
  ['twenty high-risk locations', 'Twenty places identified as especially risky. The selection method is not specified here.'],
] as const;

export function clauseReadings(source: AmendmentSource) {
  const original = DEMO_ITEMS.find(item => source.kind === 'sample' && item.id === source.id && item.proposedText === source.text);
  return original ? readings.filter(([phrase]) => source.text.includes(phrase)) : [];
}

export default function ClauseReader({ source, revision }: { source: AmendmentSource; revision: string }) {
  const id = useId().replace(/:/g, '');
  const [selected, setSelected] = useState<string | null>(null);
  const [textOnly, setTextOnly] = useState(false);
  const transition = useRef<ViewTransition | null>(null);
  const matches = clauseReadings(source);
  const active = matches.find(([phrase]) => phrase === selected);
  const name = `clause-${id}`;
  function choose(phrase: string) {
    transition.current?.skipTransition();
    const update = () => { setSelected(phrase); };
    if (textOnly) { update(); return; }
    void runViewTransition(update, 'clause-explain', value => { transition.current = value; }).catch(update);
  }
  // Preserve every source character; only explicitly mapped phrases become controls.
  const pieces: React.ReactNode[] = [];
  let offset = 0;
  const ordered = matches.map(([phrase]) => ({ phrase, start: source.text.indexOf(phrase) })).sort((a, b) => a.start - b.start);
  for (const { phrase, start } of ordered) {
    pieces.push(source.text.slice(offset, start));
    pieces.push(<button key={phrase} id={`${id}-phrase-${start}`} type="button" aria-controls={`${id}-explanation`} aria-pressed={selected === phrase} onClick={() => choose(phrase)}><span style={{ viewTransitionName: !textOnly && selected !== phrase ? name + '-' + start : undefined }}>{phrase}</span></button>);
    offset = start + phrase.length;
  }
  pieces.push(source.text.slice(offset));
  return <section className="clause-reader" aria-label="Explore draft phrases">
    <h3>Explore layers of this draft</h3>
    <p>{source.kind === 'sample' ? 'Fictional sample · not legal text.' : 'Citizen proposal · unverified.'} Explanations are unreviewed reading aids, never law or legal advice. Civic choices remain advisory.</p>
    <p>Origin: {source.origin} · {source.kind}:{source.id} · Amendment revision: {revision}</p>
    <label><input type="checkbox" checked={textOnly} onChange={e => { transition.current?.skipTransition(); setTextOnly(e.target.checked); }} /> Text-only reading (no morph)</label>
    <div className="amendment-comparison">
      <section><h4>Exact draft text</h4><p className="clause-source">{source.text ? pieces : 'No draft text available.'}</p></section>
      <section id={`${id}-explanation`} tabIndex={-1} aria-label="Plain-English reading" aria-live="polite">
        <h4>Plain-English reading · unreviewed</h4>
        {active ? <><p><strong style={{ viewTransitionName: textOnly ? undefined : name + '-' + source.text.indexOf(active[0]) }}>{active[0]}</strong></p><p>{active[1]}</p><p>Uncertainty: terminology only; legal effect, eligibility, costs and implementation have not been verified.</p><p>Citation: exact phrase in the draft shown alongside, revision {revision}. Background references are context, not evidence that this wording is law.</p><a href={`#${id}-phrase-${source.text.indexOf(active[0])}`}>Return to source phrase</a></> : <p>{matches.length ? 'Choose an underlined phrase to inspect its reading.' : 'No matched explanation is available for this exact draft. No interpretation has been generated.'}</p>}
      </section>
    </div>
    <p>Not interpreted: {matches.length ? 'all text outside the marked phrases, interactions between clauses, definitions, exceptions and legal status. Phrase boundaries are reading aids, not official clause boundaries.' : 'the entire draft, including its legal effect.'} Editing draft text removes these sample mappings. Nothing is published or voted on by reading.</p>
  </section>;
}
