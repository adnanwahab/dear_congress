import data from '../generated/eudaimonia-100.json';
export const billCollection = data;
export type CatalogBill = typeof data.bills[number];
export function searchBills(query: string, category: string) {
  const terms = query.trim().toLocaleLowerCase('en-US').split(/\s+/).filter(Boolean);
  return data.bills.filter(b => (!category || b.category === category) && terms.every(term =>
    [b.id, b.title, b.category, b.jurisdiction, b.problem, b.proposedChange, b.safeguards, b.metrics, b.dimensions].join(' ').toLocaleLowerCase('en-US').includes(term)));
}
