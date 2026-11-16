import snapshots from '../generated/sample-permalinks.json';
/** Public identities only; never include browser choices or journey preferences. */
export const samplePermalink = (id: string) => `/samples/${encodeURIComponent(id)}/${snapshots.find(s => s.item.id === id)?.revision ?? "unavailable"}`;
export const officialPermalink = (id: string, revision: string) => `/official-records/${encodeURIComponent(id)}/${encodeURIComponent(revision)}`;
