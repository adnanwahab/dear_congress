import queue from '../../data/editorial/daily-questions.json';
import { chicagoDate } from './daily-question';

export interface EditorialAssignment {
  date: string;
  revisionId: string;
  approval: { reviewer: string; reviewedAt: string } | null;
}

/** Immutable content archive; assignments can be rolled back without deleting revisions. */
export const editorialQueue = queue;
export function reviewedEditorialQuestion(now: Date, assignments: readonly EditorialAssignment[] = queue.schedule) {
  const matches = assignments.filter(entry => entry.date === chicagoDate(now));
  if (matches.length !== 1) return undefined;
  const entry = matches[0]!;
  const approval = entry.approval;
  if (!approval?.reviewer.trim() || !Number.isFinite(Date.parse(approval.reviewedAt)) || Date.parse(approval.reviewedAt) > +now) return undefined;
  const revision = queue.revisions.find(revision => revision.revisionId === entry.revisionId);
  return revision ? { ...revision, date: entry.date, approval } : undefined;
}
