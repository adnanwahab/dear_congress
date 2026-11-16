/** Read-only editorial records. Never used for voting, synthesis or causal scores. */
export type ClaimKind = 'Primary source' | 'Editorial inference' | 'User claim' | 'Synthetic estimate';
export interface StudyEvidence {
  id: string;
  kind: ClaimKind;
  case: string;
  design: string;
  sample: string;
  jurisdiction: string;
  outcome: string;
  date: string;
  limitations: string;
  conflicts: string;
  source: { title: string; url: string; locator: string } | null;
  history: readonly { revision: string; date: string; actor: string; reason: string; review: 'Pending human review'; reviewer: null }[];
}
const history = [{ revision: 'evidence-v1', date: '2026-11-14', actor: 'Repository editorial fixture', reason: 'Initial matrix transcription; source and interpretation kept separate', review: 'Pending human review' as const, reviewer: null }];
const source = { title: 'Baicker et al., NEJM (2013)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3701298/', locator: 'Abstract: Methods and Conclusions; DOI 10.1056/NEJMsa1212321' };
export const STUDY_EVIDENCE: readonly StudyEvidence[] = [
  { id: 'oregon-clinical', kind: 'Primary source', case: 'Sourced study', design: 'Randomized Medicaid lottery', sample: '6,387 lottery-selected and 5,842 nonselected adults, approximately two years later', jurisdiction: 'Oregon, US', outcome: 'Depression and financial strain decreased; measured physical-health improvements were not statistically significant over two years.', date: '2013-05-02', limitations: 'Two-year follow-up; eligibility and lottery setting limit generalization. Nonsignificance does not establish no effect.', conflicts: 'Funding and author disclosure forms require human review; no absence of conflicts inferred.', source, history },
  { id: 'oregon-interpretation', kind: 'Editorial inference', case: 'Conflicting interpretation', design: 'Interpretation of the same study, not independent replication', sample: 'Same study; do not count twice', jurisdiction: 'Oregon, US', outcome: 'A claim of universal health benefit conflicts with the mixed endpoint findings; endpoints must be considered separately.', date: '2026-11-14', limitations: 'Editorial example, not a causal estimate or a second study; no policy recommendation follows.', conflicts: 'Editorial selection has not been independently reviewed.', source, history },
  { id: 'missing-claim', kind: 'User claim', case: 'Missing source example', design: 'Not supplied', sample: 'Unknown', jurisdiction: 'Not supplied', outcome: 'Illustrative claim: this proposal benefits everyone. Unsupported; not a finding.', date: '2026-11-14', limitations: 'Invented example of an unverified user claim; no study, period or population supplied.', conflicts: 'Not disclosed', source: null, history },
  { id: 'synthetic-wait', kind: 'Synthetic estimate', case: 'Synthetic transit example', design: 'Invented before/after fixture', sample: 'Fictional pilot households', jurisdiction: 'Fictional transit pilot', outcome: 'Typical wait: 20 minutes (2024) to 15 minutes (2025).', date: '2025', limitations: 'Synthetic measurement fixture, not observed data; no uncertainty or causal attribution.', conflicts: 'Repository-authored demonstration; no external study.', source: null, history },
];
export type StudySort = 'case' | 'kind' | 'design' | 'sample' | 'jurisdiction' | 'outcome' | 'date' | 'limitations' | 'conflicts';
export function sortStudies(rows: readonly StudyEvidence[], key: StudySort, descending = false) {
  return [...rows].sort((a, b) => (a[key].localeCompare(b[key]) || a.id.localeCompare(b.id)) * (descending ? -1 : 1));
}
export function evidenceExport(rows: readonly StudyEvidence[]) {
  return JSON.stringify({ schema: 'study-evidence-v1', criteria: 'Design, population, applicability, endpoint, uncertainty, limitations and disclosures; no viewpoint or composite score.', records: rows }, null, 2);
}
