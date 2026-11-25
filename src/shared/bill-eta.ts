import ledger from '../../content/bill-collections/eudaimonia-100-reviews.json';
import { billCollection, type CatalogBill } from './bill-catalog';
import type { EditorialDecision, EditorialReview } from './bill-editorial';

/**
 * Estimated date of arrival (ETA) for each curated draft.
 *
 * "Arrival" means the draft has finished human review (assignment, legal, evidence,
 * fiscal and publication review) and a one-week advisory ballot on that exact revision
 * has closed. It is a planning estimate derived from the review ledger and the
 * assumptions below. It never reads or writes votes, reviews, publications or receipts,
 * and it is not a schedule, a commitment, a prediction of enactment or official status.
 * Deterministic for a given `asOf` date.
 */
export type ArrivalScenario = 'earliest' | 'expected' | 'latest';
export type ArrivalStageKey = 'assignment' | 'review' | 'publication' | 'ballot';
type Days = Record<ArrivalScenario, number>;
export type ArrivalStage = { key: ArrivalStageKey; label: string; days: Days };
export type ArrivalModel = { id: string; cadenceDays: Days; stages: readonly ArrivalStage[] };

export const ARRIVAL_MODEL: ArrivalModel = {
  id: 'civic-arrival-estimate/v1',
  /** Days between successive review starts within one category: two a week, one a week, one a fortnight. */
  cadenceDays: { earliest: 3.5, expected: 7, latest: 14 },
  stages: [
    { key: 'assignment', label: 'Author and human editor assigned', days: { earliest: 3, expected: 7, latest: 14 } },
    { key: 'review', label: 'Legal, evidence and fiscal reviews (in parallel)', days: { earliest: 14, expected: 21, latest: 42 } },
    { key: 'publication', label: 'Publication review and publisher attestation', days: { earliest: 3, expected: 7, latest: 14 } },
    { key: 'ballot', label: 'One-week advisory ballot closes', days: { earliest: 7, expected: 7, latest: 7 } },
  ],
};

export const ARRIVAL_NOTE = 'Planning estimate for finishing human review and a one-week advisory ballot at the assumed pace. '
  + 'Not a schedule, a commitment, a prediction of enactment, or official status.';

export type ArrivalEstimate = {
  billId: string;
  model: string;
  /** UTC date the estimate was computed for. */
  asOf: string;
  /** Monday on or after `asOf`: the next weekly review cycle. */
  cycleStart: string;
  category: string;
  /** 0-based place in the category's review queue; null once no review work remains. */
  queuePosition: number | null;
  queueSize: number;
  /** Expected date work on this draft starts. */
  startsOn: string;
  stages: { key: ArrivalStageKey; label: string; done: boolean; expected: string | null }[];
  earliest: string;
  expected: string;
  latest: string;
};

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const named = (value: unknown) => typeof value === 'string' && !!value.trim();
const approved = (decision: EditorialDecision | undefined) => decision?.status === 'approved' && named(decision.reviewer) && named(decision.record);

/** Monday on or after `asOf` (UTC). */
export function cycleStart(asOf: Date): number {
  const day = utcDay(asOf);
  return day + ((8 - new Date(day).getUTCDay()) % 7) * DAY;
}

/** Stages still outstanding according to the review ledger. Fails closed: a missing,
 * duplicate or stale record (other revision or jurisdiction) leaves every stage open.
 * The ballot stage always remains because ballot results are not read here. */
export function remainingStages(bill: CatalogBill, records: readonly EditorialReview[] = ledger): Set<ArrivalStageKey> {
  const left = new Set<ArrivalStageKey>(['assignment', 'review', 'publication', 'ballot']);
  const matches = records.filter(row => row.id === bill.id);
  const review = matches.length === 1 ? matches[0] : undefined;
  if (!review || review.revision !== bill.revision || review.jurisdiction !== bill.jurisdiction) return left;
  if (named(review.author) && named(review.editor)) left.delete('assignment');
  if (approved(review.legal) && approved(review.evidence) && approved(review.fiscal)) left.delete('review');
  if (!left.has('assignment') && !left.has('review') && approved(review.publication)) left.delete('publication');
  return left;
}

/** Arrival estimates for every draft, keyed by bill ID. Each week reviewers start the
 * next draft (in ID order) in every category; drafts already past review do not queue. */
export function estimateArrivals(
  asOf: Date = new Date(),
  bills: readonly CatalogBill[] = billCollection.bills,
  records: readonly EditorialReview[] = ledger,
  model: ArrivalModel = ARRIVAL_MODEL,
): Map<string, ArrivalEstimate> {
  const start = cycleStart(asOf);
  const left = new Map(bills.map(bill => [bill.id, remainingStages(bill, records)] as const));
  const queued = (bill: CatalogBill) => { const stages = left.get(bill.id)!; return stages.has('assignment') || stages.has('review'); };
  const queues = new Map<string, string[]>();
  for (const bill of [...bills].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!queued(bill)) continue;
    const queue = queues.get(bill.category) ?? [];
    queue.push(bill.id);
    queues.set(bill.category, queue);
  }
  const estimates = new Map<string, ArrivalEstimate>();
  for (const bill of bills) {
    const stages = left.get(bill.id)!, queue = queues.get(bill.category) ?? [];
    const position = queued(bill) ? queue.indexOf(bill.id) : null;
    const run = (scenario: ArrivalScenario) => {
      const begin = start + Math.ceil((position ?? 0) * model.cadenceDays[scenario]) * DAY;
      let t = begin;
      const ends = model.stages.map(stage => stages.has(stage.key) ? (t += stage.days[scenario] * DAY) : null);
      return { begin, end: t, ends };
    };
    const earliest = run('earliest'), expected = run('expected'), latest = run('latest');
    estimates.set(bill.id, {
      billId: bill.id, model: model.id, asOf: isoDay(utcDay(asOf)), cycleStart: isoDay(start), category: bill.category,
      queuePosition: position, queueSize: queue.length, startsOn: isoDay(expected.begin),
      stages: model.stages.map((stage, i) => ({ key: stage.key, label: stage.label, done: !stages.has(stage.key), expected: expected.ends[i] == null ? null : isoDay(expected.ends[i]!) })),
      earliest: isoDay(earliest.end), expected: isoDay(expected.end), latest: isoDay(latest.end),
    });
  }
  return estimates;
}

/** First and last expected arrival across a set of estimates. */
export function arrivalSpan(estimates: Iterable<ArrivalEstimate>) {
  let first = '', last = '';
  for (const estimate of estimates) {
    if (!first || estimate.expected < first) first = estimate.expected;
    if (!last || estimate.expected > last) last = estimate.expected;
  }
  return { first, last };
}

const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
/** "2027-01-04" → "Jan 4, 2027" (UTC, locale-stable). */
export const formatArrival = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
export const ordinal = (n: number) => {
  const tens = n % 100, ones = n % 10;
  return `${n}${tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`;
};
