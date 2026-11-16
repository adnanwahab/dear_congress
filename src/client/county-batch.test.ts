import { expect, test } from 'bun:test';
import counties from './data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN } from './county-simulation';
import { evaluateCountyBatch, startCountyBatch } from './county-batch';
const ids = counties.map(c => c.id);
test('batch preserves exact plan, county order and deterministic votes across every revision', async () => {
  let plan = [...INITIAL_PLAN];
  for (let revision = 2; revision <= 10; revision++) {
    const progress: number[] = [];
    const result = await evaluateCountyBatch(ids, plan, done => progress.push(done), () => false);
    plan = improvePlan(plan, ids);
    expect(result).toEqual({ plan, votes: ids.map(id => countyVote(id, plan)) });
    expect(progress.at(-1)).toBe(3144);
    expect(progress.every((n, i) => i === 0 || n > progress[i - 1]!)).toBe(true);
  }
});
test('fallback yields to controls and cancellation never publishes partial results', async () => {
  let cancel = false;
  let ticks = 0;
  const timer = setInterval(() => { ticks++; cancel = true; }, 0);
  const result = await evaluateCountyBatch(ids, INITIAL_PLAN, () => {}, () => cancel);
  clearInterval(timer);
  expect(ticks).toBeGreaterThan(0);
  expect(result).toBeNull();
});
test('cancel suppresses fallback completion and progress', async () => {
  let calls = 0;
  const cancel = startCountyBatch(ids, INITIAL_PLAN, false, () => calls++, () => calls++);
  cancel();
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(calls).toBe(0);
});
test('bundled worker computes the same results and reports progress', async () => {
  const { buildBrowser } = await import('../server/browser-build');
  const build = await buildBrowser(true);
  const artifact = build.outputs.find(output => output.path.endsWith('/county-worker.js'))!;
  expect(artifact).toBeDefined();
  const path = `/tmp/she-942-worker-${process.pid}.js`;
  await Bun.write(path, artifact);
  const worker = new Worker(path);
  try {
    const progress: number[] = [];
    const result = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('worker timeout')), 4000);
      worker.onerror = reject;
      worker.onmessage = event => { progress.push(event.data.done); if (event.data.result) { clearTimeout(timer); resolve(event.data.result); } };
      worker.postMessage({ ids, plan: INITIAL_PLAN });
    });
    const plan = improvePlan(INITIAL_PLAN, ids);
    expect(result).toEqual({ plan, votes: ids.map(id => countyVote(id, plan)) });
    expect(progress.length).toBeGreaterThan(1);
  } finally { worker.terminate(); await Bun.file(path).delete(); }
});
test('worker failure falls back once; late worker replies cannot publish', async () => {
  const original = globalThis.Worker;
  let instance: any;
  class FailedWorker {
    onmessage: any;
    onerror: any;
    onmessageerror: any;
    terminated = false;
    constructor() { instance = this; }
    postMessage() { setTimeout(() => { this.onerror({ preventDefault() {} }); this.onmessageerror(); }, 0); }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FailedWorker as any;
  try {
    let completions = 0;
    await new Promise<void>(resolve => {
      startCountyBatch(ids, INITIAL_PLAN, true, () => {}, result => {
        completions++;
        expect(result.plan).toEqual(improvePlan(INITIAL_PLAN, ids));
        resolve();
      });
    });
    instance.onmessage({ data: { done: ids.length, result: { plan: [], votes: [] } } });
    expect(completions).toBe(1);
    expect(instance.terminated).toBe(true);
  } finally { globalThis.Worker = original; }
});
