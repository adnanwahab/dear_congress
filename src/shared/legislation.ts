export interface BillMetadata {
  id: string; congress: number; type: 'hr' | 's'; number: number; title: string;
  chamber: 'House' | 'Senate'; sourceUrl: string; introducedDate: string;
  sponsors: string[]; latestAction: { actionDate: string; text: string };
  upstreamUpdatedAt: string | null;
}
export interface BillObservation extends BillMetadata {
  checkedAt: string; sourceHash: string; refreshFailed: boolean;
}
export function metadataFreshness(bill: BillObservation, now = Date.now()) {
  const checked = Date.parse(bill.checkedAt);
  const age = now - checked;
  if (!Number.isFinite(age) || age < 0) return 'Unavailable: invalid check time';
  if (bill.refreshFailed) return `Refresh failed · cache age ${Math.floor(age / 60000)} minutes`;
  return `${age >= 86400000 ? 'Stale' : 'Metadata as checked'} · cache age ${Math.floor(age / 60000)} minutes`;
}
