/** Curated research inventory, independent of observations, ballots and synthesis. */
export type ClaimKind = 'Primary source' | 'Editorial inference' | 'User claim' | 'Synthetic estimate';
export interface GapClaim {
  kind: ClaimKind; text: string; period: string; observedAt: string | null;
  source: { publisher: string; url: string; locator: string } | null;
  limitations: string;
}
export interface DataGap {
  id: string; jurisdiction: string; topic: string; metric: string;
  category: 'Sourced definition' | 'Conflicting evidence' | 'Missing source';
  claims: readonly GapClaim[]; question: string;
  agency: { name: string; url: string; basis: string } | null;
  history: readonly { revision: string; date: string; author: string; reason: string; review: 'Pending human review' }[];
}
const history = [{ revision: 'atlas-v1', date: '2026-11-14', author: 'Repository implementation', reason: 'Initial research inventory; no outcome registration or source verification by a human.', review: 'Pending human review' as const }];
export const DATA_GAPS: readonly DataGap[] = [
  {
    id: 'acs-travel-definition', jurisdiction: 'Harris County, Texas', topic: 'Transit', metric: 'Travel time to work', category: 'Sourced definition',
    claims: [
      { kind: 'Primary source', text: 'The 2023 ACS one-year B08303 schema defines travel-time estimates and margins of error.', period: '2023 ACS one-year release', observedAt: '2026-11-14', source: { publisher: 'U.S. Census Bureau', url: 'https://api.census.gov/data/2023/acs/acs1/groups/B08303.html', locator: 'B08303_001E and B08303_001M' }, limitations: 'This is a sourced metric definition, not a retrieved Harris County value or a policy effect. No numeric observations are registered.' },
      { kind: 'Editorial inference', text: 'A county commute distribution alone cannot establish whether an evening bus pilot improved trips.', period: 'Research assessment, 2026-11-14', observedAt: null, source: null, limitations: 'Editorial research question; route, time-of-day, baseline and comparison evidence still needed.' },
    ],
    question: 'Can the data steward provide a dated county extract with margins of error, then identify route-level evening observations and a comparable baseline?',
    agency: { name: 'U.S. Census Bureau — ACS', url: 'https://www.census.gov/programs-surveys/acs.html', basis: 'Publisher of the linked ACS schema; not the operator of local transit.' }, history,
  },
  {
    id: 'evening-wait-conflict', jurisdiction: 'Houston, Texas', topic: 'Transit', metric: 'Evening bus wait', category: 'Conflicting evidence',
    claims: [
      { kind: 'User claim', text: 'Illustrative claim: evening waits became shorter.', period: 'Fictional 2025 pilot', observedAt: null, source: null, limitations: 'Invented user-claim example, not a resident submission. No interview, sample or source supplied.' },
      { kind: 'Synthetic estimate', text: 'Illustrative model: evening waits increased from 15 to 20 minutes.', period: 'Fictional 2024–2025 comparison', observedAt: null, source: null, limitations: 'Invented conflict fixture. No real measurement, uncertainty model or causal attribution; do not average these claims.' },
    ], question: 'Which routes, service dates and wait definition does each claim cover? Request timestamped arrivals and sampling methods before resolving the disagreement.', agency: null, history,
  },
  {
    id: 'step-free-missing', jurisdiction: 'Harris County, Texas', topic: 'Accessibility', metric: 'Step-free evening trips', category: 'Missing source',
    claims: [{ kind: 'Editorial inference', text: 'No source for this metric is registered in this atlas.', period: 'Inventory as of 2026-11-14', observedAt: null, source: null, limitations: 'Missing here does not mean no public dataset exists. Coverage, outcomes and responsible agency are unknown; never substitute zero.' }],
    question: 'Who maintains a dated, accessible inventory of step-free evening trips, including lift outages, route coverage and excluded trips?', agency: null, history,
  },
];
export function filterGaps(rows: readonly DataGap[], filters: { jurisdiction: string; topic: string; category: string; query: string }) {
  return rows.filter(row => (!filters.jurisdiction || row.jurisdiction === filters.jurisdiction) && (!filters.topic || row.topic === filters.topic) && (!filters.category || row.category === filters.category) && `${row.metric} ${row.question}`.toLowerCase().includes(filters.query.trim().toLowerCase()));
}
export function exportGaps(rows: readonly DataGap[]) {
  return JSON.stringify({ schema: 'public-data-gaps-v1', scope: 'Filtered research inventory; missing means unknown, never good outcomes. No policy effects registered.', records: rows }, null, 2);
}
