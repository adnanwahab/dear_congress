export interface BillMetadata {
  id: string; jurisdiction: 'US'; congress: number; type: 'hr' | 's'; number: number; title: string;
  chamber: 'House' | 'Senate'; sourceUrl: string; introducedDate: string;
  sponsors: string[]; latestAction: { actionDate: string; text: string };
  upstreamUpdatedAt: string | null;
}
export interface BillObservation extends BillMetadata {
  // Retrieval attempt start time; both timestamps refer to the last successful archive.
  checkedAt: string; retrievedAt: string; sourceHash: string; refreshFailed: boolean;
}
export interface UnavailableBill {
  id: string; jurisdiction: 'US'; congress: number; type: 'hr' | 's'; number: number;
  state: 'unavailable'; attemptedAt: string;
}
export interface LegislationSnapshot { bills: BillObservation[]; unavailable: UnavailableBill[] }
export function metadataFreshness(bill: BillObservation, now = Date.now()) {
  const checked = Date.parse(bill.checkedAt);
  const age = now - checked;
  if (!Number.isFinite(age) || age < 0) return 'Unavailable: invalid check time';
  if (bill.refreshFailed) return `Refresh failed · cache age ${Math.floor(age / 60000)} minutes`;
  return `${age >= 86400000 ? 'Stale' : 'Metadata as checked'} · cache age ${Math.floor(age / 60000)} minutes`;
}
