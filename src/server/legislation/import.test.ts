import { expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBill, readBills, refreshBill } from './import';
import { metadataFreshness } from '../../shared/legislation';
// Synthetic Congress.gov-shaped fixtures, never published as fetched official evidence.
const fixture = (overrides = {}) => JSON.stringify({ bill: { congress: 119, type: 'HR', number: '123', originChamber: 'House', title: 'Synthetic test bill', introducedDate: '2025-01-03', sponsors: [{ fullName: 'Synthetic sponsor' }], latestAction: { actionDate: '2025-01-03', text: 'Introduced in House' }, ...overrides } });
const fetchRaw = (raw: string) => (async () => new Response(raw));
test('Congress/session and chamber isolate reintroductions and companions; no status inferred from passage or sponsor withdrawal', () => {
  const house = parseBill(fixture(), 119, 'hr', 123);
  const reintroduced = parseBill(fixture({ congress: 120 }), 120, 'hr', 123);
  const senate = parseBill(fixture({ type: 'S', originChamber: 'Senate' }), 119, 's', 123);
  expect(new Set([house.id, reintroduced.id, senate.id]).size).toBe(3);
  for (const text of ['Passed House', 'Passed Senate', 'Sponsor withdrawn', 'Measure withdrawn', 'Became Public Law No: 119-1.']) {
    const bill = parseBill(fixture({ latestAction: { actionDate: '2025-01-04', text } }), 119, 'hr', 123);
    expect(bill.latestAction.text).toBe(text);
    expect(bill).not.toHaveProperty('legalStatus');
    expect(bill).not.toHaveProperty('effectiveDate');
  }
  expect(() => parseBill(fixture(), 119, 's', 123)).toThrow();
  expect(() => parseBill(fixture({ introducedDate: '2025-02-30' }), 119, 'hr', 123)).toThrow();
});
test('refresh archives exact bytes, preserves corrections and marks failures without advancing last-good time', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bills-'));
  let time = new Date('2026-11-13T00:00:00Z');
  const refresh = (raw: string) => refreshBill(root, 119, 'hr', 123, 'secret-test-key', fetchRaw(raw), () => time);
  try {
    await refresh(fixture());
    const first = (await readBills(root))[0]!;
    expect(metadataFreshness(first, time.getTime() + 86400000)).toStartWith('Stale');
    expect(metadataFreshness(first, time.getTime() - 1)).toStartWith('Unavailable');
    time = new Date('2026-11-13T01:00:00Z');
    await refresh(fixture({ title: 'Corrected test bill' }));
    const corrected = (await readBills(root))[0]!;
    expect(corrected.sourceHash).not.toBe(first.sourceHash);
    expect(await readFile(join(root, 'raw', `${first.sourceHash}.json`), 'utf8')).toBe(fixture());
    for (const raw of ['invalid json', fixture({ congress: 118 }), '{"api_key":"secret-test-key"}']) {
      time = new Date(time.getTime() + 1000);
      await expect(refresh(raw)).rejects.toThrow('last-good');
      const retained = (await readBills(root))[0]!;
      expect(retained.checkedAt).toBe(corrected.checkedAt);
      expect(retained.refreshFailed).toBe(true);
      expect(metadataFreshness(retained, time.getTime())).toStartWith('Refresh failed');
    }
    expect(await readdir(join(root, 'raw'))).toHaveLength(2);
    await writeFile(join(root, 'raw', `${corrected.sourceHash}.json`), fixture());
    await expect(readBills(root)).rejects.toThrow('integrity');
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('empty archives have no invented evidence; HTTP errors retain an unavailable result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bills-'));
  try {
    expect(await readBills(root)).toEqual([]);
    await expect(refreshBill(root, 119, 'hr', 123, 'secret-test-key', (async () => new Response('rate limit', { status: 429 })))).rejects.toThrow();
    expect(await readBills(root)).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('fetch is restricted to identity-bound HTTPS detail endpoint, with redirect refusal and no credentials in archive', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bills-'));
  try {
    await refreshBill(root, 119, 'hr', 123, 'secret-test-key', async (url, init) => {
      expect(url.origin + url.pathname).toBe('https://api.congress.gov/v3/bill/119/hr/123');
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(fixture());
    });
    for (const file of await readdir(join(root, 'attempts'))) {
      const raw = await readFile(join(root, 'attempts', file), 'utf8');
      expect(raw).not.toContain('secret-test-key');
      expect(raw).toContain('congress-detail-metadata.v1');
    }
    await refreshBill(root, 119, 'hr', 123, 'secret-test-key', fetchRaw(fixture()));
    expect(await readdir(join(root, 'raw'))).toHaveLength(1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
