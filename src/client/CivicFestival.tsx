import { SourceStatus } from './SourceStatus';
import type { DemoPayload } from '../engine/demo';
import './civic-festival.css';

/** Read-only learning: never records attendance, answers, votes or rewards. */
export function CivicFestival({ data, failed, retry }: { data: DemoPayload | null; failed: boolean; retry: () => void }) {
  const item = data?.items[0];
  return <section className="panel civic-festival" aria-labelledby="festival-title">
    <h2 id="festival-title">A little civic discovery, every week</h2>
    <p>Drop in, get curious, leave whenever you like. These optional, self-guided sessions repeat weekly; all three are available anytime, here in your browser. No registration, attendance tracking, points or prizes.</p>
    <p>Monday theme: check a claim. Wednesday theme: follow the evidence. Weekend theme: walk through a change. No live host, meeting time or physical venue is scheduled.</p>
    <div className="festival-sessions">
      <details><summary>Monday · Civic trivia · 2 minutes</summary>
        <p>Can reading a proposal or opening this session cast an advisory vote?</p>
        <details><summary>Reveal the answer</summary><p>No. Reading is optional learning. Only an explicit voting action saves an advisory preference. An advisory preference is not an official ballot or government decision.</p></details>
        <p><a href="/documentation">Read the participation guide</a></p>
      </details>
      <details><summary>Wednesday · Evidence tour · 5 minutes</summary>
        <ol><li>Open <a href="/published">Published sources</a> and check the official or sample label.</li><li>Follow the original source; compare jurisdiction, date and exact text. An empty official lane means no imported record, not that no bills exist.</li><li>Identify what is unknown. A background link does not verify a fictional proposal or a model prediction.</li></ol>
      </details>
      <details><summary>Weekend · Proposal walkthrough · 10 minutes</summary>
        {failed ? <><p role="alert">The sample walkthrough could not be refreshed. Try again before starting.</p><button type="button" onClick={retry}>Retry walkthrough</button></> : !data ? <p role="status">Loading the sample walkthrough…</p> : !item ? <p>No sample proposal is available. You can still try trivia or the evidence tour.</p> : <>
          <SourceStatus kind="sample" /><p><strong>Fictional sample: {item.title}</strong></p><p>{item.summary}</p>
          <ol><li>Read the current and proposed text. Which words change?</li><li>Identify a benefit, a trade-off and a missing source.</li><li>Follow the sample draft to a possible sponsor. No office is contacted; sponsor outcomes are simulated.</li></ol>
          <a href={`/feed?proposal=${encodeURIComponent(item.id)}`}>Start this sample walkthrough</a>
        </>}
      </details>
    </div>
    <h3>Official events elsewhere</h3>
    <p>No verified hosted event is listed here. The <a href="https://www.loc.gov/events/" target="_blank" rel="noopener noreferrer">Library of Congress official event calendar</a> lists external events and their locations. Check each organizer’s current date, time zone, online or physical location, access requirements and cancellation notices before attending. This is a directory link, not a partnership or a confirmed local event.</p>
    <details><summary>Hypothetical gathering · planning example only</summary><p>A neighborhood evidence picnic could pair trivia with reading a source together. This is an idea, not a scheduled event: no organizer, venue, date or registration is confirmed.</p></details>
    <h3>Discussion and participation</h3>
    <p>Public event discussion is unavailable until a moderator and reporting process are in place. These sessions do not publish comments. For any future hosted discussion: cite sources, welcome disagreement, avoid personal attacks and private information, and let moderators pause or remove harmful content.</p>
    <p>There are no rewards for ideology, real votes, advisory choices or bringing other voters. Learning never changes your saved choices. Fictional proposals and model simulations remain separate from real advisory activity.</p>
  </section>;
}
