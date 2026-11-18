import { expect, test } from 'bun:test';
import { billCollection } from './bill-catalog';
import { ATLAS_REGIONS, atlasBills, atlasFreshness } from './policy-atlas';
test('regions contain all 50 states and DC exactly once; geographic evidence expires', () => {
  const states = ATLAS_REGIONS.flatMap(r => r.states.split(', '));
  expect(states.length).toBe(51);
  expect(new Set(states).size).toBe(51);
  expect(atlasFreshness(Date.parse('2026-11-18'))).toContain('checked');
  expect(atlasFreshness(Date.parse('2026-12-19'))).toContain('stale');
  expect(atlasFreshness(Date.parse('2026-11-16'))).toContain('stale');
});
test('empty, invalid and unassigned scopes never invent regional evidence or mutate identities', () => {
  const before = JSON.stringify(billCollection);
  expect(atlasBills([], new URLSearchParams('region=west'))).toEqual([]);
  expect(atlasBills(billCollection.bills, new URLSearchParams('region=unknown'))).toEqual([]);
  expect(atlasBills(billCollection.bills, new URLSearchParams('region=west&scope=city'))).toEqual([]);
  expect(atlasBills(billCollection.bills, new URLSearchParams('scope=city')).length).toBeGreaterThan(0);
  expect(atlasBills(billCollection.bills, new URLSearchParams('region=south')).every(b => b.jurisdiction === 'federal')).toBe(true);
  expect(JSON.stringify(billCollection)).toBe(before);
});
