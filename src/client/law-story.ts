import type { Stage } from '../shared/civic-stages';

export interface LawChapter {
  title: string;
  stage: Stage;
  scene: string;
  narration: string;
  boundary: string;
}
export const STORY_PROPOSAL = 'demo-transit';
export const LAW_CHAPTERS: readonly LawChapter[] = [
  { title: 'A need after dark', stage: 'feed', scene: 'The shift ends. The bus has not arrived.', narration: 'Alex, a fictional evening worker, misses a connection. A shared need becomes a question: could buses run more often after work? The Feed lets readers explore a sample proposal.', boundary: 'Hypothetical lived experience; no resident testimony is quoted. Publishing your own journal is a separate, public action requiring your choice.' },
  { title: 'Follow the source', stage: 'published', scene: 'A question meets a source, not a promise.', narration: 'Alex checks the transit agency background before trusting the proposal. Published separates official references from fictional sample changes. A reference does not establish that this proposal is law.', boundary: 'Real agency background; hypothetical proposal. METRO is a regional transit authority, not a city bill or a congressional sponsor.' },
  { title: 'Make room for disagreement', stage: 'votes', scene: 'More service? What about the cost?', narration: 'Neighbors weigh evening access against costs and competing priorities. Votes offers advisory choices. Reading this chapter casts no vote; illustrative totals are not a representative public poll.', boundary: 'Hypothetical deliberation and illustrative tallies. Browser advisory preferences do not authorize legislation or repository merges.' },
  { title: 'Write a testable draft', stage: 'draft', scene: 'A wish becomes words people can inspect.', narration: 'The sample draft proposes a twelve-month pilot of fifteen-minute service through 10 p.m. on three corridors, with quarterly reporting. Readers compare the current approach and proposed clause, then ask what needs revision.', boundary: 'Hypothetical draft, not quoted law or legal advice. A download is not a filing, enactment or permission to reuse private stories.' },
  { title: 'Find the responsible office', stage: 'sponsors', scene: 'A draft needs someone who can act.', narration: 'Alex explores a possible transit board handoff. Sponsors rehearses preparation and follow-up. A real process would require jurisdiction review, an authorized decision maker, funding and the applicable public procedures; routes differ by institution.', boundary: 'Hypothetical sponsor; no office endorses the draft. Nothing is sent. Any real outreach requires a separate, explicit decision.' },
  { title: 'Ask what actually changed', stage: 'outcomes', scene: 'Did the last bus bring people home?', narration: 'If a pilot were adopted, compare missed trips, access to jobs and ridership with a dated baseline and sources. Include costs, mixed results and missing data before deciding whether to expand, revise or stop. Outcomes separates simulated outreach from measurement prototypes.', boundary: 'Hypothetical implementation; measurement fixtures are synthetic. No verified implemented policy or measured benefit is claimed, and a reply is not enactment.' },
];
