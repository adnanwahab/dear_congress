/** Local synthetic evidence only; never contacts the public site. */
import counties from '../src/client/data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN } from '../src/client/county-simulation';
import { evaluateCountyBatch } from '../src/client/county-batch';
import { buildBrowser } from '../src/server/browser-build';
const ids = counties.map(c => c.id);
const build = await buildBrowser(true);
const path = `/tmp/she-942-benchmark-${process.pid}.js`;
await Bun.write(path, build.outputs.find(o => o.path.endsWith('/county-worker.js'))!);
const measurements = [];
try {
  for (const mode of ['before-sync', 'after-fallback', 'after-worker']) {
    for (let run = 0; run < 5; run++) {
      let ticks = 0;
      let maxGap = 0;
      let last = performance.now();
      const timer = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++; }, 1);
      const start = performance.now();
      if (mode === 'before-sync') {
        const plan = improvePlan(INITIAL_PLAN, ids);
        ids.map(id => countyVote(id, plan));
      } else if (mode === 'after-fallback') {
        await evaluateCountyBatch(ids, INITIAL_PLAN, () => {}, () => false);
      } else {
        const worker = new Worker(path);
        try {
          await new Promise<void>((resolve, reject) => {
            worker.onerror = reject;
            worker.onmessage = event => { if (event.data.result) resolve(); };
            worker.postMessage({ ids, plan: INITIAL_PLAN });
          });
        } finally { worker.terminate(); }
      }
      const elapsedMs = performance.now() - start;
      maxGap = Math.max(maxGap, performance.now() - last);
      clearInterval(timer);
      measurements.push({ mode, run, elapsedMs, heartbeatTicks: ticks, maxHeartbeatGapMs: maxGap });
    }
  }
  console.log(JSON.stringify({ runtime: Bun.version, counties: ids.length, scope: 'Local Bun compute/worker microbenchmark; excludes React, layout and browser input latency', measurements }, null, 2));
} finally { await Bun.file(path).delete(); }
