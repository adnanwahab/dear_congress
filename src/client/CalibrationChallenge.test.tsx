import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalibrationChallenge, calibrationReceipt } from './CalibrationChallenge';
import type { LawBehaviorReceipt } from './LawBehaviorExplorer';

const receipt: LawBehaviorReceipt = {
  schemaVersion: 'hbl-law-behavior-receipt.v1', status: 'completed',
  law: { id: 'law-83', number: 83, title: 'Transit' }, engine: 'population', unit: 'minute',
  manifest: { seed: 42, modelVersion: 'test-v1', population: 24, implementationStrength: .5,
    pairedInitialState: true, start: 0, end: 720, recordedCheckpoints: 1, scope: 'synthetic world' },
  frames: [{ time: 0, baseline: { metrics: { meanCommuteMinutes: 12 }, actors: [] }, edited: { metrics: { meanCommuteMinutes: 10 }, actors: [] } }],
};
test('gap replay preserves exact inputs and recorded outputs without inventing a public match', () => {
  const before = JSON.stringify(receipt);
  const audit = calibrationReceipt(receipt, 'meanCommuteMinutes', 'minutes/trip');
  expect(JSON.parse(JSON.stringify(audit)).modelReceipt).toEqual(receipt);
  expect(audit).toEqual(calibrationReceipt(receipt, 'meanCommuteMinutes', 'minutes/trip'));
  expect(audit.fit).toBeNull();
  expect(audit.observation).toBeNull();
  expect(audit.inputs).toEqual({ lawId: 83, implementationStrength: .5, population: 24 });
  expect(JSON.stringify(receipt)).toBe(before);
});
test('all observable choices remain gaps; similar units never imply comparability', () => {
  for (const metric of ['meanCommuteMinutes', 'employmentRate', 'meanRent', 'unknown']) {
    const audit = calibrationReceipt(receipt, metric, 'fraction');
    expect(audit.status).toBe('data-gap');
    expect(audit.fit).toBeNull();
  }
});
test('accessible static gap view exposes provenance, mismatches and uncertainty without network or animation', () => {
  const html = renderToStaticMarkup(<CalibrationChallenge receipt={receipt} metric="meanCommuteMinutes" unit="minutes/trip"/>);
  for (const text of ['Seed 42', 'test-v1', '720', 'Major uncertainty', 'Census ACS', 'OpenFEMA', 'Houston 311', 'not forecasts', '<summary>', 'scope="col"', 'role="status"']) expect(html).toContain(text);
  const missing = calibrationReceipt({ ...receipt, manifest: null }, '', 'unavailable');
  expect(missing.seed).toBeNull();
  expect(missing.modelVersion).toBeNull();
});
