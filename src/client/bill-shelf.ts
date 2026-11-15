import type { CatalogBill } from '../shared/bill-catalog';
export const SHELF_KEY = 'adnanwahab/dear_congress:curated-draft:eudaimonia-100:v1:shelf';
export const SHELF_MAX = 4;
export type ShelfEntry = { id: string; revision: string };
export function readShelf(raw: string | null): ShelfEntry[] {
  try {
    if (raw && raw.length > 2000) return [];
    const data: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(data) || data.length > SHELF_MAX) return [];
    if (!data.every(e => e && typeof e === 'object' && /^HFL-\d{3}$/.test(e.id) && /^[a-f0-9]{64}$/.test(e.revision))) return [];
    if (new Set(data.map(e => e.id)).size !== data.length) return [];
    return data.map(e => ({ id: e.id, revision: e.revision }));
  } catch { return []; }
}
export function resolveShelf(entry: ShelfEntry, bills: CatalogBill[]) {
  return bills.find(b => b.id === entry.id && b.revision === entry.revision);
}
