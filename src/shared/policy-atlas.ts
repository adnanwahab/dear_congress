import type { CatalogBill } from './bill-catalog';

export const ATLAS_SOURCE = 'https://www.census.gov/programs-surveys/economic-census/guidance-geographies/levels.html';
export const ATLAS_CHECKED = '2026-11-17';
// Census statistical regions, not governments, constituencies or support estimates.
export const ATLAS_REGIONS = [
  { id: 'west', name: 'West', states: 'Alaska, Arizona, California, Colorado, Hawaii, Idaho, Montana, Nevada, New Mexico, Oregon, Utah, Washington, Wyoming' },
  { id: 'midwest', name: 'Midwest', states: 'Illinois, Indiana, Iowa, Kansas, Michigan, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota, Wisconsin' },
  { id: 'northeast', name: 'Northeast', states: 'Connecticut, Maine, Massachusetts, New Hampshire, New Jersey, New York, Pennsylvania, Rhode Island, Vermont' },
  { id: 'south', name: 'South', states: 'Alabama, Arkansas, Delaware, District of Columbia, Florida, Georgia, Kentucky, Louisiana, Maryland, Mississippi, North Carolina, Oklahoma, South Carolina, Tennessee, Texas, Virginia, West Virginia' },
] as const;
export function atlasFreshness(now = Date.now()) {
  const age = now - Date.parse(`${ATLAS_CHECKED}T00:00:00Z`);
  return age < 0 || age > 30 * 86400000 ? 'Geography reference stale / requires recheck' : `Geography reference checked ${ATLAS_CHECKED}`;
}
export function atlasSelection(params: URLSearchParams) {
  const raw = params.get('region') ?? '';
  return { region: ATLAS_REGIONS.find(r => r.id === raw), invalid: !!raw && !ATLAS_REGIONS.some(r => r.id === raw) };
}
export function atlasBills(bills: CatalogBill[], params: URLSearchParams) {
  const scope = params.get('scope') ?? '';
  // Generic state/city/county labels cannot establish any geographic binding.
  const { region, invalid } = atlasSelection(params);
  if (invalid) return [];
  return bills.filter(b => (!scope || b.jurisdiction === scope) && (!region || b.jurisdiction === 'federal'));
}
