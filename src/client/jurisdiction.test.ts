import { expect, test } from 'bun:test';
import { DEMO_ITEMS } from '../engine/demo';
import { sampleMatchesJurisdiction, validJurisdiction } from './JurisdictionPicker';

test('exact sample scope uses stable IDs, preserving regional and unknown scope', () => {
  expect(DEMO_ITEMS.filter(i => sampleMatchesJurisdiction(i.id, 'Texas')).map(i => i.id)).toEqual(['demo-mental-health', 'demo-insurance']);
  expect(DEMO_ITEMS.filter(i => sampleMatchesJurisdiction(i.id, 'Houston'))).toHaveLength(4);
  expect(sampleMatchesJurisdiction('demo-transit', 'Houston')).toBe(false);
  expect(sampleMatchesJurisdiction('future-city', 'Houston')).toBe(false);
  expect(sampleMatchesJurisdiction('future-city', '')).toBe(true);
  expect(validJurisdiction('Austin')).toBe(false);
  expect(validJurisdiction('Houston')).toBe(true);
});
test('jurisdiction workflow handles storage, filtered selection and API failures', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-jurisdiction-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS storage');
});
