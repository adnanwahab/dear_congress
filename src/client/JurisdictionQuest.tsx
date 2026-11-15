import { useState } from 'react';
import type { Jurisdiction } from './JurisdictionPicker';

export const LEVELS = ['Municipal', 'County', 'State', 'Federal'] as const;
export const QUEST_CARDS = [
  { id: 'city', scope: 'Houston', level: 'Municipal', prompt: 'Find the city service desk for a Houston municipal service request.', explanation: 'Houston 311 routes city service requests. A city desk does not control every service inside city boundaries; the responsible agency depends on the asset and issue.', source: 'City of Houston · 311', url: 'https://311.houstontx.gov/' },
  { id: 'county', scope: 'Harris County', level: 'County', prompt: 'Identify the governing level for the Harris County Flood Control District.', explanation: 'Harris County Commissioners Court governs this special-purpose district, created by the Texas Legislature. Flood work also involves city drainage and state and federal funding partners; county government is not the only flood authority.', source: 'Harris County Flood Control District · About', url: 'https://www.hcfcd.org/About' },
  { id: 'state', scope: 'Texas', level: 'State', prompt: 'Which level issues a Texas driver license through DPS?', explanation: 'Texas DPS issues these licenses. This does not put all transportation policy at the state level: local roads and federal standards involve other governments.', source: 'Texas DPS · Driver License', url: 'https://www.dps.texas.gov/section/driver-license' },
  { id: 'federal', scope: 'United States', level: 'Federal', prompt: 'Which level handles U.S. passport issuance?', explanation: 'The U.S. Department of State handles passports. Application acceptance can happen at local facilities; the place you submit paperwork is not necessarily the issuing authority.', source: 'U.S. Department of State · Passports', url: 'https://travel.state.gov/en/passports.html' },
] as const;
export function questCards(jurisdiction: Jurisdiction) {
  return [...QUEST_CARDS].sort((a, b) => Number(b.scope === jurisdiction) - Number(a.scope === jurisdiction));
}
export function JurisdictionQuest({ jurisdiction }: { jurisdiction: Jurisdiction }) {
  const cards = questCards(jurisdiction);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const score = cards.filter(card => answers[card.id] === card.level).length;
  return <details className="jurisdiction-quest">
    <summary>Who decides? · Sandbox matching game</summary>
    <p>Four civic riddles. Match each specific task to its responsible level, then reveal the twists. Educational demo, awaiting review; not legal advice, a ballot or a model projection. Answers stay on this page.</p>
    <p>{jurisdiction ? `${jurisdiction} comes first; other levels remain for comparison.` : 'Explore Houston, Harris County, Texas and the United States.'} No exact location is requested. Powers vary elsewhere; these examples do not establish universal rules.</p>
    <form onSubmit={event => { event.preventDefault(); setChecked(true); }}>
      {cards.map(card => <fieldset key={card.id}>
        <legend>{card.prompt}</legend>
        <label>Match a level<select value={answers[card.id] ?? ''} onChange={event => { setAnswers({ ...answers, [card.id]: event.target.value }); setChecked(false); }} required>
          <option value="">Choose a level</option>{LEVELS.map(level => <option key={level}>{level}</option>)}
        </select></label>
        {checked && <p><strong>{answers[card.id] === card.level ? 'Matched!' : `Try this: ${card.level}.`}</strong> {card.explanation}</p>}
        <p className="workflow-provenance"><a href={card.url} target="_blank" rel="noopener noreferrer">{card.source} ↗</a> · Checked 2026-11-14. Background for this task only. If unavailable, use the named publisher; the game works offline after loading.</p>
      </fieldset>)}
      <button type="submit" disabled={cards.some(card => !answers[card.id])}>Check matches</button>{' '}
      <button type="button" onClick={() => { setAnswers({}); setChecked(false); }}>Start again</button>
      <p role="status" aria-live="polite">{checked ? `${score} of ${cards.length} matched. Explanations and overlaps are shown with each task.` : `${Object.keys(answers).filter(id => answers[id]).length} of ${cards.length} answered. Use Tab and the select arrow keys, or tap each choice.`}</p>
    </form>
  </details>;
}
