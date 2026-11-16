import { Fragment, useEffect, useId, useRef, useState } from 'react';
import './civic-glossary.css';

type Definition = { meaning: string; example: string; editorial: string };
export const CIVIC_GLOSSARY = {
  appropriation: { meaning: 'Legal authority to spend public money for a specified purpose. A proposal alone does not authorize spending.', example: 'An illustrative council measure sets aside money for library hours.', editorial: 'Editorial explanation; spending rules depend on the jurisdiction.' },
  committee: { meaning: 'A smaller group within a legislative body that examines matters such as proposed laws.', example: 'A transportation committee reviews a proposed bus program before the full council considers it.', editorial: 'Editorial explanation; committee powers vary by institution.' },
  quorum: { meaning: 'The minimum participation required by the decision rule of a particular body.', example: 'If a fictional nine-member council requires five members present, five is its quorum.', editorial: 'Editorial example, not this app’s configured quorum. Browser advisory votes are not verified merge authority.' },
  amendment: { meaning: 'A proposed change to an existing text, such as a bill or proposal. Suggesting one does not adopt it.', example: 'A reader suggests changing a draft’s start date from July to September.', editorial: 'Editorial explanation; formal amendment procedures vary.' },
  'effective date': { meaning: 'The date a law or a particular provision begins to operate. It may differ from the date of passage or signing.', example: 'A fictional measure passed in May says its new rules begin on October 1.', editorial: 'Editorial example; check the exact official text and jurisdiction for a real law.' },
} satisfies Record<string, Definition>;
export type CivicTerm = keyof typeof CIVIC_GLOSSARY;

export function CivicDefinition({ term, children }: { term: CivicTerm; children?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const definition = CIVIC_GLOSSARY[term];
  function close() { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return <span ref={wrapper} className="civic-term" onKeyDown={event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={trigger} type="button" className="civic-term-trigger" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}>{children ?? term}</button>
    {open && <span id={id} role="dialog" aria-label={`${term} definition`} className="civic-definition">
      <strong>{term}</strong><span>{definition.meaning}</span><span><b>Example:</b> {definition.example}</span><small>{definition.editorial} General reading help, not legal advice or verification of a proposal.</small><button type="button" onClick={close}>Close definition</button>
    </span>}
  </span>;
}

/** Only plain text is annotated. Links, source IDs and stored source text stay intact. */
export function GlossaryText({ text }: { text: string }) {
  return <>{text.split(/(\b(?:appropriations?|committees?|quorums?|amendments?|effective dates?)\b)/gi).map((part, index) => {
    const term = part.toLowerCase().replace(/s$/, '') as CivicTerm;
    return Object.hasOwn(CIVIC_GLOSSARY, term) ? <CivicDefinition key={index} term={term}>{part}</CivicDefinition> : <Fragment key={index}>{part}</Fragment>;
  })}</>;
}
