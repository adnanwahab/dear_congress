/** Public proposal text only: never pass API payloads or browser ballots to storage. */
export interface FollowSource { kind: 'sample' | 'citizen'; id: string; title: string; text: string; }
export interface FollowRecord { source: FollowSource; followedAt: string; previousText: string | null; observedAt: string | null; }
export const FOLLOW_KEY = 'civic_proposal_follows_v1';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export const followIdentity = (s: FollowSource) => JSON.stringify([s.kind, s.id]);
function source(s: FollowSource): FollowSource { return { kind: s.kind, id: s.id, title: s.title, text: s.text }; }
export function readFollows(storage: Storage): FollowRecord[] {
  const raw = storage.getItem(FOLLOW_KEY);
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.items) || data.items.length > 200 || !data.items.every((r: FollowRecord) => r?.source && ['sample', 'citizen'].includes(r.source.kind) && ['id','title','text'].every(k => typeof (r.source as unknown as Record<string, unknown>)[k] === 'string') && typeof r.followedAt === 'string' && (r.previousText === null || typeof r.previousText === 'string') && (r.observedAt === null || typeof r.observedAt === 'string'))) throw new Error('Watchlist cannot be read. Export or delete it before saving again.');
  return data.items.map((r: FollowRecord) => ({ source: source(r.source), followedAt: r.followedAt, previousText: r.previousText, observedAt: r.observedAt }));
}
export function writeFollows(storage: Storage, items: FollowRecord[]) { storage.setItem(FOLLOW_KEY, JSON.stringify({ version: 1, items })); }
export function toggleFollow(storage: Storage, s: FollowSource, now = new Date().toISOString()) {
  const items = readFollows(storage), key = followIdentity(s);
  const next = items.some(r => followIdentity(r.source) === key) ? items.filter(r => followIdentity(r.source) !== key) : [...items, { source: source(s), followedAt: now, previousText: null, observedAt: null }];
  if (next.length > 200) throw new Error('Watchlist is full (200 proposals). Unfollow a proposal first.');
  writeFollows(storage, next); return next;
}
export function observeFollow(storage: Storage, s: FollowSource, now = new Date().toISOString()) {
  const items = readFollows(storage);
  const row = items.find(r => followIdentity(r.source) === followIdentity(s));
  if (!row || JSON.stringify(row.source) === JSON.stringify(source(s))) return;
  row.previousText = row.source.text; row.source = source(s); row.observedAt = now;
  writeFollows(storage, items);
}
