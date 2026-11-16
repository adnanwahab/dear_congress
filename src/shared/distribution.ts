/** Fixed launch vocabulary prevents contact details and arbitrary campaign identifiers. */
export const DISTRIBUTION_SOURCES = ['community', 'newsletter', 'social', 'direct'] as const;
export const DISTRIBUTION_CAMPAIGNS = ['launch', 'comprehension', 'usefulness'] as const;
export const DISTRIBUTION_TTL = 30 * 60 * 1000;
export type Distribution = { source: string; campaign: string; landing: string; expires: number };
export function distributionMarker(value: unknown, now = Date.now()): Distribution | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Distribution;
  if (!(DISTRIBUTION_SOURCES as readonly string[]).includes(v.source) || !(DISTRIBUTION_CAMPAIGNS as readonly string[]).includes(v.campaign) || typeof v.landing !== 'string' || !Number.isSafeInteger(v.expires) || v.expires <= now || v.expires > now + DISTRIBUTION_TTL) return null;
  return { source: v.source, campaign: v.campaign, landing: v.landing, expires: v.expires };
}
