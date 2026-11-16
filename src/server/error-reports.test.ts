import { expect, test } from 'bun:test';
import { emptyDB } from '../engine/engine';
import { DEMO_ITEMS } from '../engine/demo';
import { createErrorReportHandlers, resolveErrorTarget, errorReportPage, errorTriagePage } from './error-reports';
import { createPublicSecurity, publicHandler } from './public-security';
const request = (body: unknown, origin = 'http://localhost') => new Request('http://localhost/api/error-reports', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
async function setup(save = async () => {}) {
  const db = emptyDB();
  const target = (await resolveErrorTarget(db, 'sample', DEMO_ITEMS[0]!.id)).target;
  const body = { ...target, idempotencyKey: crypto.randomUUID(), reason: '<script>bad</script> Evidence missing; please qualify this claim.', reporterId: 'DO-NOT-STORE' };
  return { db, target, body, handlers: createErrorReportHandlers(() => db, save) };
}
test('reports pin snapshots, omit identity, retry safely and survive serialization', async () => {
  const { db, target, body, handlers } = await setup();
  const before = JSON.stringify(db);
  expect((await handlers.submit(request(body))).status).toBe(201);
  expect((await handlers.submit(request(body))).status).toBe(200);
  expect(db.errorReports).toHaveLength(1);
  const record = JSON.parse(JSON.stringify(db)).errorReports[0];
  expect(record.target).toEqual(target);
  expect(record.snapshot).toBe(JSON.stringify(DEMO_ITEMS[0]));
  expect(JSON.stringify(record)).not.toContain('DO-NOT-STORE');
  const { errorReports, ...rest } = db;
  expect(rest).toEqual(JSON.parse(before));
  await expect(handlers.submit(request({ ...body, reason: 'Changed' }))).rejects.toMatchObject({ status: 409 });
  const html = await errorTriagePage(db).text();
  expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>bad');
});
test('stale revisions, unknown kinds, forged IDs and empty text cannot enter queue', async () => {
  const { db, body, handlers } = await setup();
  for (const change of [{ revision: 'stale' }, { kind: 'repository-pr' }, { id: 'missing' }, { reason: '' }, { reason: 'x'.repeat(4001) }]) {
    await expect(handlers.submit(request({ ...body, ...change, idempotencyKey: crypto.randomUUID() }))).rejects.toBeDefined();
  }
  expect(db.errorReports ?? []).toHaveLength(0);
  await expect(errorReportPage(new Request('http://localhost/report-error?' + new URLSearchParams({ kind: body.kind, id: body.id, revision: 'stale' })), db)).rejects.toMatchObject({ status: 409 });
});
test('human triage retains original and history, rejects stale decisions, rolls back failed saves', async () => {
  let failing = false;
  const { db, body, handlers } = await setup(async () => { if (failing) throw Error('disk'); });
  await handlers.submit(request(body));
  const original = structuredClone(db.errorReports![0]!);
  await handlers.decide(request({ id: original.id, expectedVersion: 1, status: 'reviewing', correctionNote: 'Checking source; no claim verified yet.' }));
  expect(db.errorReports![0]!.version).toBe(2);
  expect(db.errorReports![0]!.snapshot).toBe(original.snapshot);
  await expect(handlers.decide(request({ id: original.id, expectedVersion: 1, status: 'corrected', correctionNote: 'stale' }))).rejects.toMatchObject({ status: 409 });
  const before = structuredClone(db.errorReports);
  failing = true;
  await expect(handlers.decide(request({ id: original.id, expectedVersion: 2, status: 'declined', correctionNote: 'Insufficient evidence' }))).rejects.toThrow('disk');
  expect(db.errorReports).toEqual(before);
  await expect(handlers.submit(request({ ...body, idempotencyKey: crypto.randomUUID() }))).rejects.toThrow('disk');
  expect(db.errorReports).toEqual(before);
});
test('same-origin and rate limits guard reporting without saving browser identity', async () => {
  const { body, handlers, db } = await setup();
  const security = createPublicSecurity({ PUBLIC_ID_LIMIT: '1', PUBLIC_IP_LIMIT: '1' });
  const run = (origin: string) => publicHandler(security, '/api/error-reports', 'POST', request(body, origin), '127.0.0.1', () => handlers.submit(request(body)));
  expect((await run('https://foreign.example')).status).toBe(403);
  expect((await run('http://localhost')).status).toBe(429);
  expect(db.errorReports ?? []).toHaveLength(0);
});
test('proposal/source namespaces stay distinct and catalog includes supplement snapshot', async () => {
  const db = emptyDB();
  const a = await resolveErrorTarget(db, 'sample', DEMO_ITEMS[0]!.id);
  const b = await resolveErrorTarget(db, 'sample-source', DEMO_ITEMS[0]!.id);
  expect(a.target).not.toEqual(b.target);
  const catalog = await resolveErrorTarget(db, 'catalog', 'HFL-051');
  expect(JSON.parse(catalog.snapshot)[1]).toContain('#');
});
