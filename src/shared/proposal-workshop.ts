/** Workshop notes stay separate from published proposals and advisory ballots. */
export const WORKSHOP_AGENDA = [
  ['problem', 'Define the problem', 'Who is affected, and what experience needs to change?'],
  ['evidence', 'Review evidence', 'Record title, URL, date, locator and limitations. Separate observations from assumptions.'],
  ['goals', 'Agree goals', 'What measurable improvement would help? Record disagreements too.'],
  ['constraints', 'Name constraints', 'Consider rights, jurisdiction, cost, access and implementation capacity.'],
  ['options', 'Explore options', 'Compare alternatives, including doing nothing; retain objections and trade-offs.'],
  ['questions', 'Keep open questions', 'What needs checking, by whom, before a proposal is published?'],
] as const;
export type WorkshopField = typeof WORKSHOP_AGENDA[number][0];
export type WorkshopNotes = Record<WorkshopField, string>;
export interface WorkshopSource { id: string; title: string; problem: string; proposedChange: string; supportingInfo?: string; publishedAt: string; sourceEntryId?: string }
export function workshopNotes(source: WorkshopSource): WorkshopNotes {
  return { problem: source.problem, evidence: source.supportingInfo ?? '', goals: '', constraints: '', options: source.proposedChange, questions: '' };
}
export function workshopExport(source: WorkshopSource, notes: WorkshopNotes, facilitator: string): string {
  return [
    'WORKSHOP PROPOSAL DRAFT · NOT PUBLISHED · NOT CONSENSUS',
    source.title, `Source: citizen:${source.id} · /proposals/${encodeURIComponent(source.id)}`,
    `Published source date: ${source.publishedAt}`,
    ...(source.sourceEntryId ? [`Journal source: ${source.sourceEntryId}`] : []),
    `Facilitator / note author (self-described, unverified): ${facilitator.trim() || 'Unnamed browser facilitator'}`,
    'Source text: citizen-authored. Workshop notes: facilitator-authored, not attributed to other participants. No simulated participants. Citations and official status are unverified.',
    ...WORKSHOP_AGENDA.flatMap(([key, label]) => [`\n${label}`, notes[key].trim() || '[Open — needs discussion]']),
    '\nPublic collaboration disabled: reporting, moderation, participant consent and withdrawal require implementation. This export grants no publication permission and changes no votes.',
  ].join('\n');
}
