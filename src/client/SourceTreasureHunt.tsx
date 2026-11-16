import { useState } from 'react';
import { stageRoute } from '../shared/civic-stages';

export const HUNT_SOURCES = [
  { id: 'budget', place: 'Houston, Texas', title: 'Follow the money', publisher: 'City of Houston Finance Department', date: 'Fiscal year 2025 (historical)', url: 'https://www.houstontx.gov/budget/25budadopt/I_CES.pdf', recovery: 'https://www.houstontx.gov/budget/', prompt: 'Find an expenditure category. Compare the FY2024 estimate with the FY2025 budget. What is the difference between an estimate and a budget?', format: 'PDF' },
  { id: 'meeting', place: 'Houston, Texas', title: 'Read a meeting agenda', publisher: 'City of Houston Office of the City Secretary', date: 'September 10–11, 2024 (historical)', url: 'https://www.houstontx.gov/citysec/agenda/2024/Sep1024.pdf', recovery: 'https://www.houstontx.gov/citysec/agenda/agendaindex.html', prompt: 'Find one agenda item and its item number. What would you need to read next to learn what actually happened? An agenda alone does not prove a decision.', format: 'PDF' },
  { id: 'outcome', place: 'Harris County, Texas', title: 'Look for a measured condition', publisher: 'U.S. Census Bureau', date: '2020–2024 survey estimates; other rows have separate dates', url: 'https://www.census.gov/quickfacts/harriscountytexas', recovery: 'https://www.census.gov/quickfacts/', prompt: 'Find mean travel time to work and its measurement period. Read the definitions. Why can this measure alone not show that a particular policy worked?', format: 'Data table' },
] as const;

export default function SourceTreasureHunt() {
  const [visited, setVisited] = useState<string[]>([]);
  const [learned, setLearned] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  return <section className="source-hunt" aria-labelledby="civic-source-treasure-hunt">
    <h3 id="civic-source-treasure-hunt">Civic source treasure hunt</h3>
    <p>Explore Houston and Harris County, Texas. These are demo learning prompts linking to real governmental sources, not verified civic participation. No claims about officials are required.</p>
    <p>Open a source, read it, then mark what you learned for yourself. Progress is self-reported, stays only on this page, and resets on reload. Opening a link does not verify a visit or understanding.</p>
    <p>Source references reviewed November 14, 2026. Historical documents are not current budgets or meeting notices. Link availability is not monitored. If a source is slow, wait in its tab; if it fails or has expired, use the official index and match its title and date. Do not mark unread sources complete.</p>
    <p role="status">{learned.length} of {HUNT_SOURCES.length} learning prompts complete · self-reported demo progress</p>
    <ol>{HUNT_SOURCES.map(source => <li key={source.id}>
      <h4>{source.title}</h4>
      <p>{source.place} · {source.publisher}<br />Source date: {source.date}</p>
      <p>{source.prompt}</p>
      <a className="hunt-control" href={source.url} target="_blank" rel="noopener noreferrer" onClick={() => setVisited(current => current.includes(source.id) ? current : [...current, source.id])}>Open {source.title.toLowerCase()} · {source.format} (new tab)</a>
      <label className="hunt-control"><input type="checkbox" checked={unavailable.includes(source.id)} onChange={() => {
        setUnavailable(current => toggle(current, source.id));
        setLearned(current => current.filter(id => id !== source.id));
      }} /> Source unavailable or expired</label>
      {unavailable.includes(source.id) && <p>Source reported unavailable; completion paused. <a href={source.recovery} target="_blank" rel="noopener noreferrer">Find the dated document on the official index (new tab)</a>. Retry the source and clear this checkbox after it opens.</p>}
      <label className="hunt-control"><input type="checkbox" disabled={!visited.includes(source.id) || unavailable.includes(source.id)} checked={learned.includes(source.id)} onChange={() => setLearned(current => toggle(current, source.id))} /> I visited, read the source and considered the question</label>
    </li>)}</ol>
    <p>Continue with <a href={stageRoute('published')}>Published sources</a> or <a href={stageRoute('outcomes')}>Outcomes</a>. Official references do not verify the fictional scenarios or synthetic measurements shown in the civic stages.</p>
  </section>;
}
