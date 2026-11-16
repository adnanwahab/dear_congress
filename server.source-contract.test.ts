import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NEEDS } from './src/engine/catalog';
import { createSimulationSnapshot } from './src/server/simulation-snapshot';
import { emptyDB, extract } from './src/engine/engine';
import { DEMO_ITEMS, type DemoPayload } from './src/engine/demo';
import { billCollection } from './src/shared/bill-catalog';
import { refreshBill, readBills } from './src/server/legislation/import';

// Shape fixtures exercise real adapters/router; they are not verified official evidence.
test('source → advisory ballot → frozen simulation keeps source lanes and numerators isolated', async () => {
  const root = await mkdtemp(join(tmpdir(), 'source-contract-'));
  const env = { ...process.env };
  let server: { url: URL; stop(force?: boolean): void } | undefined;
  try {
    const archive = join(root, 'legislation');
    await refreshBill(archive, 119, 'hr', 123, 'fixture-key', async () => new Response(JSON.stringify({ bill: {
      congress: 119, type: 'HR', number: '123', originChamber: 'House', title: 'Fixture metadata only',
      introducedDate: '2025-01-03', sponsors: [],
      latestAction: { actionDate: '2025-01-04', text: 'Became Public Law No: 119-1.' },
    } })));
    const official = (await readBills(archive))[0]!;
    const db = emptyDB(); db.schemaVersion = 2;
    db.entries = [{ id: 'model-voice', author: 'Synthetic actor', text: 'Our street floods.',
      createdAt: '2026-11-01T00:00:00Z', extraction: extract('Our street floods.'), corrected: false,
      synthetic: true, source: 'happybearlandia-world' }];
    const path = join(root, 'db.json');
    await Bun.write(path, JSON.stringify(db));
    // Recorded local measurement fixture, never a claim of independently verified data.
    const measurements = await Bun.file('data/outcomes.json').json();
    await Bun.write(join(root, 'outcomes.json'), JSON.stringify(measurements));
    Object.assign(process.env, { DB_PATH: path, LEGISLATION_PATH: archive,
      OUTCOMES_PATH: join(root, 'outcomes.json'), OUTCOMES_MODE: 'shadow', PORT: '0', DEBUG_REQUEST_LOGS: '0',
      ANON_COOKIE_SECRET: 'source-contract-disposable-cookie-secret-32',
      OPENAI_API_KEY: '', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '' });
    server = (await import(`./server.ts?source-contract=${crypto.randomUUID()}`)).server;
    let cookie = '';
    const request = async (route: string, body?: unknown) => {
      const response = await fetch(new URL(route, server!.url), { method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', cookie },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
      return response;
    };
    const demo = async () => await (await request('/api/demo')).json() as DemoPayload;
    const before = await demo();
    expect(before.items).toEqual(DEMO_ITEMS);
    expect(before.verified).toEqual({ status: 'unavailable' });
    expect(Object.values(before.browserCounts).every(c => c.support + c.oppose + c.unsure === 0)).toBe(true);
    const legislation = await (await request('/api/legislation')).json();
    expect(legislation).toEqual({ coverage: 'metadata-only', bills: [official] });
    expect(official).not.toHaveProperty('legalStatus');
    expect(official).not.toHaveProperty('effectiveDate');
    const measured = await (await request('/api/outcomes')).json();
    expect(measured.mode).toBe('shadow');
    expect(measured.outcomes.series).toEqual(measurements.series);
    const vote = (proposalId: string) => ({ votes: [{ proposalId, stance: 1, importance: .5,
      acceptCompromise: true, concern: '', changeMind: '' }] });
    // Neither editorial imports nor official metadata may acquire sample ballots by ID.
    for (const id of [billCollection.bills[0]!.id, official.id]) {
      expect((await request('/api/votes', vote(id))).status).toBe(400);
    }
    expect((await request('/api/votes', vote(DEMO_ITEMS[0]!.id))).status).toBe(200);
    const voted = await demo();
    expect(voted.items).toEqual(before.items);
    expect(voted.browserCounts[DEMO_ITEMS[0]!.id]).toEqual({ support: 1, oppose: 0, unsure: 0 });
    expect(voted.verified).toEqual({ status: 'unavailable' });
    const saved = await Bun.file(path).json();
    const capture = async () => {
      const response = await request('/api/simulation-snapshots', { package: 'A', seed: 42 });
      expect(response.status).toBe(201);
      const result = await response.json();
      expect((await (await request(`/api/simulation-snapshots/${result.snapshot.id}`)).json()).snapshot).toEqual(result.snapshot);
      return result.snapshot;
    };
    const modeled = await capture();
    const withoutModelVoices = structuredClone(db);
    withoutModelVoices.entries = [];
    expect(modeled.plan).toEqual(createSimulationSnapshot(withoutModelVoices, { needs: NEEDS }).plan);
    expect(modeled.plan.proposalIds).not.toContain(official.id);
    expect(modeled.plan.proposalIds).not.toContain(billCollection.bills[0]!.id);
    expect(modeled).not.toHaveProperty('results');
    expect(modeled).not.toHaveProperty('legalStatus');
    const after = await Bun.file(path).json();
    for (const key of Object.keys(saved).filter(k => k !== 'simulationSnapshots')) expect(after[key]).toEqual(saved[key]);
    expect(await demo()).toEqual(voted);
    expect((await (await request('/api/legislation')).json()).bills).toEqual([official]);
    expect((await (await request('/api/outcomes')).json()).outcomes.series).toEqual(measurements.series);
  } finally {
    server?.stop(true);
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    await rm(root, { recursive: true, force: true });
  }
});

test('synthetic voices never change the real-input simulation package or stored ballots', () => {
  const db = emptyDB();
  const baseline = createSimulationSnapshot(db, { needs: NEEDS }).plan;
  db.entries = Array.from({ length: 100 }, (_, i) => ({ id: `synthetic-${i}`, author: 'Model actor',
    text: 'Our street floods and drainage cannot keep up.', createdAt: '2026-11-01T00:00:00Z',
    extraction: extract('Our street floods and drainage cannot keep up.'), corrected: false,
    synthetic: true, source: 'happybearlandia-world' }));
  const before = structuredClone(db);
  expect(createSimulationSnapshot(db, { needs: NEEDS }).plan).toEqual(baseline);
  expect(db).toEqual(before);
});
