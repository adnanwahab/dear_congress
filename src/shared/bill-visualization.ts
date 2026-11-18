import type { CatalogBill } from './bill-catalog';

/** All quantities here are *catalog tag counts*, never forecasts or measured effects. */
export function billDimensions(bill: Pick<CatalogBill, 'dimensions'>): string[] {
  return bill.dimensions.split(';').map(tag => tag.trim()).filter(Boolean);
}

export function flourishingDimensions(bills: readonly CatalogBill[]): string[] {
  return [...new Set(bills.flatMap(billDimensions))].sort((a, b) => a.localeCompare(b));
}

export function dimensionCount(bills: readonly CatalogBill[], dimension: string, category?: string): number {
  return bills.filter(bill => (!category || bill.category === category) && billDimensions(bill).includes(dimension)).length;
}

export function sharedDimensionCount(bills: readonly CatalogBill[], left: string, right: string): number {
  if (left === right) return dimensionCount(bills, left);
  return bills.filter(bill => {
    const dimensions = billDimensions(bill);
    return dimensions.includes(left) && dimensions.includes(right);
  }).length;
}

export function billRelatedness(left: CatalogBill, right: CatalogBill): number {
  if (left.id === right.id) return 0;
  const labels = new Set(billDimensions(left));
  return billDimensions(right).filter(dim => labels.has(dim)).length;
}

export function billsForFocus(bills: readonly CatalogBill[], focus: { dimension: string; category?: string } | null): CatalogBill[] {
  return focus ? bills.filter(bill => (!focus.category || bill.category === focus.category) && billDimensions(bill).includes(focus.dimension)) : [...bills];
}
