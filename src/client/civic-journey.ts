export const JOURNEY_KEY = 'civic_private_journey_v1';
export const JOURNEY_CATEGORIES = ['Topics', 'Drafts', 'Sandbox runs', 'Explicit votes'] as const;
export type JourneyCategory = typeof JOURNEY_CATEGORIES[number];
export const JOURNEY_KINDS = ['Personal learning', 'Citizen advisory activity', 'Seeded fiction', 'Model simulation'] as const;
export interface JourneyEntry { id: string; savedAt: string; category: JourneyCategory; kind: typeof JOURNEY_KINDS[number]; text: string; }
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function readJourney(store: Store): JourneyEntry[] {
  const raw = store.getItem(JOURNEY_KEY);
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 500 || !value.entries.every((e: JourneyEntry) => e && typeof e.id === 'string' && typeof e.savedAt === 'string' && Number.isFinite(Date.parse(e.savedAt)) && JOURNEY_CATEGORIES.includes(e.category) && JOURNEY_KINDS.includes(e.kind) && typeof e.text === 'string' && e.text.trim().length > 0 && e.text.length <= 200000) || new Set(value.entries.map((e: JourneyEntry) => e.id)).size !== value.entries.length) throw Error('Saved journey is unreadable. Export it before resetting.');
  return value.entries;
}
export function saveJourneyEntry(store: Store, entry: JourneyEntry) {
  const entries = readJourney(store);
  if (entries.length >= 500) throw Error('Journey is full (500 entries). Export or delete entries first.');
  const next = [entry, ...entries];
  const raw = JSON.stringify({ version: 1, entries: next });
  readJourney({ ...store, getItem: () => raw });
  store.setItem(JOURNEY_KEY, raw);
}
export function deleteJourneyEntry(store: Store, id: string) {
  store.setItem(JOURNEY_KEY, JSON.stringify({ version: 1, entries: readJourney(store).filter(e => e.id !== id) }));
}
