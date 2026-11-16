import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Fixed loopback target: never accepts a production URL or inherited app credentials.
const origin = 'http://127.0.0.1:3107';
const output = new URL('../../artifacts/vitals/', import.meta.url);
await mkdir(output, { recursive: true });
const server = spawn('bun', ['--no-env-file', 'scripts/accessibility-server.ts'], {
  cwd: new URL('../../', import.meta.url), stdio: 'inherit',
  env: Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].filter(k => process.env[k]).map(k => [k, process.env[k]])),
});
let browser;
const reports = [];
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error('Isolated server exited');
    try { if ((await fetch(`${origin}/healthz`)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!ready) throw new Error('Isolated server unavailable');
  browser = await chromium.launch();
  for (const route of ['/', '/feed', '/votes']) for (let run = 1; run <= 3; run++) {
    const id = `${route === '/' ? 'home' : route.slice(1)}-${run}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await context.route('**/*', async request => {
      const req = request.request();
      if (new URL(req.url()).origin !== origin || !['GET', 'HEAD'].includes(req.method())) return request.abort();
      return request.continue();
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const trace = [];
    cdp.on('Tracing.dataCollected', data => trace.push(...data.value));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,loading,blink.user_timing', transferMode: 'ReportEvents' });
    await page.addInitScript(() => {
      const evidence = { lcp: null, cls: 0, events: [], supported: PerformanceObserver.supportedEntryTypes };
      window.vitalsEvidence = evidence;
      new PerformanceObserver(list => { for (const e of list.getEntries()) evidence.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      let start = 0, last = 0, score = 0;
      new PerformanceObserver(list => { for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        if (!start || e.startTime - last >= 1000 || e.startTime - start >= 5000) { start = e.startTime; score = 0; }
        last = e.startTime; score += e.value; evidence.cls = Math.max(evidence.cls, score);
      } }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) evidence.events.push({ name: e.name, duration: e.duration, interactionId: e.interactionId }); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });
    try {
      const response = await page.goto(`${origin}${route}`);
      if (!response?.ok()) throw new Error(`Navigation failed: ${response?.status()}`);
      await page.locator('main h1').first().waitFor();
      if (route !== '/') await page.getByRole('searchbox', { name: 'Search sample proposals', exact: true }).waitFor();
      await page.waitForTimeout(5000);
      // Benign, visible local interaction; no vote or publication requests.
      await page.getByRole('button', { name: /^Theme:/ }).tap();
      await page.waitForTimeout(1000);
      const metrics = await page.evaluate(() => window.vitalsEvidence);
      const inputMs = Math.max(0, ...metrics.events.map(e => e.duration));
      const valid = metrics.lcp !== null && ['event', 'layout-shift', 'largest-contentful-paint'].every(t => metrics.supported.includes(t));
      reports.push({ route, run, ...metrics, inputMs, valid, pass: valid && metrics.lcp <= 2500 && metrics.cls <= .1 && inputMs <= 200 });
    } finally {
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end'); await complete;
      await writeFile(new URL(`${id}.trace.json`, output), JSON.stringify({ traceEvents: trace }));
      await context.tracing.stop({ path: new URL(`${id}.zip`, output).pathname });
      await context.close();
    }
  }
  const report = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), platform: `${process.platform}/${process.arch}`, profile: { cpu: 4, latencyMs: 150, downloadBytesSec: 200000, uploadBytesSec: 93750, viewport: '390x844', observationMs: 5000, runs: 3 }, budgets: { lcpMs: 2500, cls: .1, interactionProxyMs: 200 }, reports };
  await writeFile(new URL('summary.json', output), JSON.stringify(report, null, 2));
  console.table(reports.map(({ route, run, lcp, cls, inputMs, valid, pass }) => ({ route, run, lcp, cls, inputMs, valid, pass })));
  if (reports.some(r => !r.pass)) process.exitCode = 1;
} catch (error) {
  await writeFile(new URL('failure.json', output), JSON.stringify({ error: String(error), reports }, null, 2));
  throw error;
} finally {
  await browser?.close(); server.kill('SIGTERM');
}
