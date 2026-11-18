import { describe, expect, test } from 'bun:test';
import { billCollection } from './bill-catalog';
import { billDimensions, billsForFocus, billRelatedness, dimensionCount, flourishingDimensions, sharedDimensionCount } from './bill-visualization';

const bills = billCollection.bills;

describe('Human Flourishing visualization data', () => {
  test('derives categories and tags from the catalog without invented impacts', () => {
    expect(bills).toHaveLength(100);
    expect(billCollection.categories).toHaveLength(10);
    expect(billCollection.categories.every(category => bills.filter(bill => bill.category === category).length === 10)).toBe(true);
    const dimensions = flourishingDimensions(bills);
    expect(dimensions).toContain('Relationships');
    expect(dimensions).toContain('Economic security');
    expect(dimensions.every(dimension => dimensionCount(bills, dimension) > 0)).toBe(true);
    expect(dimensions.reduce((total, dimension) => total + dimensionCount(bills, dimension), 0)).toBe(bills.reduce((total, bill) => total + billDimensions(bill).length, 0));
  });

  test('filtering a heatmap cell shows only matching catalog bills', () => {
    const matches = billsForFocus(bills, { dimension: 'Relationships', category: 'Friendship, community, and belonging' });
    expect(matches).toHaveLength(10);
    expect(matches.every(bill => billDimensions(bill).includes('Relationships'))).toBe(true);
    expect(billsForFocus(bills, { dimension: 'No such tag' })).toHaveLength(0);
    expect(billsForFocus(bills, null)).toHaveLength(100);
  });

  test('co-occurrences count shared tags only, not effects or correlations', () => {
    const dimensions = flourishingDimensions(bills);
    for (const left of dimensions) for (const right of dimensions) {
      expect(sharedDimensionCount(bills, left, right)).toBe(sharedDimensionCount(bills, right, left));
      expect(sharedDimensionCount(bills, left, right)).toBeLessThanOrEqual(dimensionCount(bills, left));
    }
    const a = bills.find(bill => bill.id === 'HFL-051')!;
    const b = bills.find(bill => bill.id === 'HFL-059')!;
    expect(billRelatedness(a, b)).toBeGreaterThan(0);
    expect(billRelatedness(a, a)).toBe(0);
  });
});
