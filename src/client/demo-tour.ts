import { CIVIC_STAGES } from '../shared/civic-stages';
const CAPTIONS = ['Start with official source links behind fictional sample proposals.', 'Browse sample changes and their plain-English summaries.', 'Explore illustrative advisory tallies without casting a vote.', 'Compare the current approach with a proposed sample clause.', 'See how a sample draft reaches a possible sponsor; nothing is sent.', 'Track simulated replies, referrals and next steps.'];
export const TOUR_STOPS = [
  ...CIVIC_STAGES.map((s, i) => ({ route: s.route, title: s.title, caption: CAPTIONS[i]!, duration: 8000 })),
  { route: '/map', title: 'Map', caption: 'Watch synthetic county requirements shape a sample plan; no resident ballots are counted.', duration: 12000 },
];
export function tourState(url: URL) {
  if (url.searchParams.get('demo') !== '1') return null;
  const raw = url.searchParams.get('step') ?? '0';
  const step = /^\d+$/.test(raw) && Number(raw) < TOUR_STOPS.length ? Number(raw) : 0;
  return { step, paused: url.searchParams.get('paused') === '1' };
}
export function tourUrl(step: number, paused = false) {
  const safe = Math.max(0, Math.min(TOUR_STOPS.length - 1, step));
  return `${TOUR_STOPS[safe]!.route}?demo=1&step=${safe}${paused ? '&paused=1' : ''}`;
}
