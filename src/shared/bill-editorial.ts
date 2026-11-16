import ledger from '../../content/bill-collections/eudaimonia-100-reviews.json';
import type { CatalogBill } from './bill-catalog';

export type EditorialDecision = { status: string; reviewer: string | null; record: string | null };
export type EditorialReview = {
  id: string; revision: string; jurisdiction: string;
  author: string | null; editor: string | null;
  legal: EditorialDecision; evidence: EditorialDecision; fiscal: EditorialDecision;
  publication: EditorialDecision;
};
const assigned = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const approved = (decision: EditorialDecision | undefined) => decision?.status === 'approved'
  && assigned(decision.reviewer) && assigned(decision.record);

/** Human review readiness only. This does not authorize or create a ballot. */
export function editorialGate(bill: CatalogBill, records: readonly EditorialReview[] = ledger) {
  const matches = records.filter(row => row.id === bill.id);
  const review = matches.length === 1 ? matches[0] : undefined;
  const blockers: string[] = [];
  if (!review) blockers.push('Missing or duplicate review record');
  if (review?.revision !== bill.revision || review?.jurisdiction !== bill.jurisdiction)
    blockers.push('Review does not match current text revision and jurisdiction');
  if (!assigned(review?.author)) blockers.push('Author unassigned');
  if (!assigned(review?.editor)) blockers.push('Human editor unassigned');
  for (const kind of ['legal', 'evidence', 'fiscal', 'publication'] as const) {
    if (!approved(review?.[kind])) blockers.push(`${kind} review requires a named human and review record`);
  }
  return { review, blockers, reviewReady: blockers.length === 0,
    // No authorized immutable catalog publishing API exists. Keep all catalog
    // revisions outside advisory ballots even after editorial readiness.
    advisoryPublicationAllowed: false as const };
}
