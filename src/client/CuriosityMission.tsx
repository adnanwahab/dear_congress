import { SourceStatus } from './SourceStatus';
import { useEffect, useState } from 'react';
import type { DemoPayload } from '../engine/demo';
import { chicagoDate } from '../shared/daily-question';
import { curiosityDeck } from '../shared/curiosity-mission';
import { TopicChip } from './TopicChip';
import { ProposalProvenance } from './ProposalProvenance';
import { stageRoute } from '../shared/civic-stages';
import './curiosity-mission.css';

export function CuriosityMission({ data, failed }: { data: DemoPayload | null; failed: boolean }) {
  const [day, setDay] = useState(() => chicagoDate(new Date()));
  const [familiar, setFamiliar] = useState('');
  const [offset, setOffset] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [reading, setReading] = useState(false);
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    const tick = () => setDay(chicagoDate(new Date()));
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  // A new date or explicit topic choice starts a fresh, independent reading mission.
  useEffect(() => { setOffset(0); setSkipped(false); setReading(false); setCompleted(false); }, [day, familiar]);
  const deck = curiosityDeck(data?.items ?? [], day, familiar);
  const item = deck[offset % deck.length];
  const identity = item?.id;
  useEffect(() => { setReading(false); setCompleted(false); }, [identity]);
  return <section className="panel curiosity-mission" aria-labelledby="curiosity-title"><SourceStatus kind="sample" />
    <p className="pill info">Demo / sandbox · pending review</p>
    <h2 id="curiosity-title">Daily curiosity mission</h2>
    <p>Explore a civic topic outside your usual interests. {day} · America/Chicago</p>
    <p>Read to complete; voting is optional and never completes this mission. Progress lasts only on this page.</p>
    <label>A topic I already know (optional) <select value={familiar} onChange={event => setFamiliar(event.target.value)}>
      <option value="">No preference</option>{[...new Set(data?.items.map(i => i.topic))].sort().map(topic => <option key={topic}>{topic}</option>)}
    </select></label>
    <details><summary>How this is selected</summary><p>Topics and proposal IDs are sorted, then rotated by the Chicago calendar date. Each topic gets a turn before another proposal in that topic. Your optional familiar topic is excluded. Shuffle advances through this order. No votes, popularity, journal history, party or ideology are used. Without your choice, we cannot know which topics are unfamiliar to you.</p><p>This lane contains fictional sample proposals only. Actual legislative records remain in their separate, labeled lane; official background links do not make a sample an actual bill. No model projection is used.</p></details>
    {!data ? <p role="status">{failed ? 'Curiosity mission unavailable. Use Try again below to reload proposals.' : 'Loading curiosity mission…'}</p> : skipped ? <><p role="status">Mission skipped. No vote or completion recorded.</p><button onClick={() => setSkipped(false)}>Resume mission</button></> : !item ? <p role="status">No other topic is available. Choose No preference or return later.</p> : <>
      <div aria-live="polite" aria-atomic="true"><TopicChip topic={item.topic} linked /><h3>{item.title}</h3><p>{item.summary}</p></div>
      <ProposalProvenance item={item} compact />
      <div className="curiosity-actions">
        <button aria-expanded={reading} aria-controls="curiosity-reading" onClick={() => setReading(value => !value)}>Learn more</button>
        <button disabled={deck.length < 2} onClick={() => { setOffset(value => value + 1); setReading(false); setCompleted(false); }}>Shuffle</button>
        <button onClick={() => { setSkipped(true); setReading(false); setCompleted(false); }}>Skip</button>
      </div>
      {reading && <div id="curiosity-reading"><h4>Sample current-rule context</h4><p>{item.currentText}</p><h4>Sample proposed change</h4><p>{item.proposedText}</p><p>What might improve, and what trade-off would you want to understand?</p><a href={stageRoute('feed', item.id)}>Continue reading in the civic stages</a><p><button onClick={() => setCompleted(true)} disabled={completed}>I’ve read the mission</button></p></div>}
      <p role="status">{completed ? 'Mission completed by reading. No vote was cast. Come back tomorrow for another topic.' : 'Mission not yet completed. Open Learn more and confirm when you have read it.'}</p>
    </>}
  </section>;
}
