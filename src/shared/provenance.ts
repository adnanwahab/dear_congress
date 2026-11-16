/** Presentation metadata only; never establishes eligibility, authority or source identity. */
export const ORIGIN_LABELS = {
  'official-source': 'Official source',
  'observed-measurement': 'Observed measurement',
  'user-submitted': 'User-submitted',
  'synthetic-model': 'Synthetic model',
  'demo-fiction': 'Demo fiction',
} as const;
export type OriginStatus = keyof typeof ORIGIN_LABELS;
export interface Provenance {
  origin: OriginStatus;
  /** null means unknown, never the current render time. */
  date: string | null;
  jurisdiction: string;
  confidence: string;
  limitations: string;
  /** null means unavailable. A background link does not authenticate a claim. */
  link: string | null;
}
export interface NumericClaim { value: number; label: string; provenance: Provenance }
export function safeProvenanceLink(value: unknown): string | null {
  try {
    if (typeof value !== 'string') return null;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function validProvenance(value: unknown): value is Provenance {
  if (!value || typeof value !== 'object') return false;
  const p = value as Provenance;
  return Object.hasOwn(ORIGIN_LABELS, p.origin) &&
    ['jurisdiction', 'confidence', 'limitations'].every(k => typeof p[k as keyof Provenance] === 'string' && String(p[k as keyof Provenance]).trim().length > 0) &&
    (p.date === null || (typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(Date.parse(p.date)) && new Date(p.date).toISOString().slice(0, 10) === p.date)) &&
    (p.link === null || safeProvenanceLink(p.link) !== null);
}
export function provenanceLines(p: Provenance): string[] {
  if (!validProvenance(p)) throw new Error('Missing or invalid provenance');
  return [ORIGIN_LABELS[p.origin], `Date: ${p.date ?? 'Unknown / not checked'}`, `Jurisdiction: ${p.jurisdiction}`, `Confidence: ${p.confidence}`, `Limitations: ${p.limitations}`, `Link: ${p.link ?? 'Unavailable'}`];
}
