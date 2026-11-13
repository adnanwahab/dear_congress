import { expect, test } from 'bun:test';
import { DEMO_ITEMS, demoPayload } from './demo';

test('browser choices remain separate from immutable synthetic totals and unavailable verification', () => {
  const records = {
    'private-cookie-one': { 'demo-housing': { stance: 1, verified: true, subject: 'credential-canary' }, 'other-proposal': { stance: 1 } },
    'private-cookie-two': { 'demo-housing': { stance: -1 } },
    'private-cookie-three': { 'demo-housing': { stance: 0 } },
  };
  const before = structuredClone(records);
  const payload = demoPayload(records, 'private-cookie-one');
  expect(payload.items).toEqual(DEMO_ITEMS);
  expect(payload.browserCounts['demo-housing']).toEqual({ support: 1, oppose: 1, unsure: 1 });
  expect(payload.browserCounts['demo-childcare']).toEqual({ support: 0, oppose: 0, unsure: 0 });
  expect(payload.browserCounts).not.toHaveProperty('other-proposal');
  expect(payload.verified).toEqual({ status: 'unavailable' });
  expect(payload.votes).toEqual({ 'demo-housing': 1 });
  for (const secret of ['private-cookie', 'credential-canary', '"subject"']) expect(JSON.stringify(payload)).not.toContain(secret);
  expect(records).toEqual(before);
  // Replacement and withdrawal reflect the retained store, without duplicate counts.
  records['private-cookie-one']['demo-housing'].stance = -1;
  expect(demoPayload(records, 'unknown').browserCounts['demo-housing']).toEqual({ support: 0, oppose: 2, unsure: 1 });
  delete (records['private-cookie-two'] as Record<string, unknown>)['demo-housing'];
  expect(demoPayload(records, 'unknown').browserCounts['demo-housing']).toEqual({ support: 0, oppose: 1, unsure: 1 });
  expect(demoPayload(records, 'unknown').votes).toEqual({});
});
