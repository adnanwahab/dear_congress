import type { BudgetRow } from './plan-budget';

export type ResidentDenominator = Readonly<{ residents: number; level: string; scope: string; source: string }>;
const nationalSource = 'https://www2.census.gov/programs-surveys/decennial/2020/data/apportionment/apportionment-2020-table02.pdf';
/** Frozen April 1, 2020 Census counts, not current population estimates. */
export const RESIDENT_DENOMINATORS: Readonly<Record<string, ResidentDenominator>> = {
  'United States': { residents: 331449281, level: 'Federal', scope: '50 states and District of Columbia; excludes Puerto Rico and other territories', source: nationalSource },
  Texas: { residents: 29145505, level: 'State', scope: 'Texas', source: nationalSource },
  'Harris County': { residents: 4731145, level: 'County', scope: 'Harris County, Texas', source: 'https://www.census.gov/quickfacts/fact/table/harriscountytexas/POP010220' },
  Houston: { residents: 2304580, level: 'City', scope: 'Houston city, Texas', source: 'https://www.census.gov/quickfacts/fact/table/houstoncitytexas/POP010220' },
};
export type ReceiptView = 'annual' | 'resident';
export function receiptValue(row: BudgetRow, view: ReceiptView): number {
  if (!Number.isSafeInteger(row.amount) || row.amount < 0 || !Number.isSafeInteger(row.amount * 1000000)) throw new Error('Fiscal amount unavailable for conversion.');
  const dollars = row.amount * 1000000;
  if (view === 'annual') return dollars;
  const denominator = RESIDENT_DENOMINATORS[row.jurisdiction];
  if (!denominator || !Number.isSafeInteger(denominator.residents) || denominator.residents <= 0) throw new Error('No sourced resident denominator for this jurisdiction. Annual amount remains available.');
  return dollars / denominator.residents;
}
export function receiptMoney(value: number): string {
  return value > 0 && value < .01 ? 'Less than $0.01' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
