import { test, expect } from '@playwright/test';

const duration = Number(process.env.MEMORY_SOAK_SECONDS ?? 1800);
if (!Number.isFinite(duration) || duration < 10 || duration > 1800) throw new Error('MEMORY_SOAK_SECONDS must be 10..1800');
const routes = ['/', '/feed', '/votes', '/needs', '/synth', '/outcomes'];
type Sample = { route: string; seconds: number; heap: number; nodes: number; listeners: number; detached: number; workers: number; fps: number; latencyMs: number; canvases: number };
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

test('foreground route exploration retains bounded resources', async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3107', serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const samples: Sample[] = [], blocked: string[] = [], errors: string[] = [];
  const start = Date.now();
  let completed = false;
  // An exact local origin and read-only HTTP guard apply to every frame/resource.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:3107' || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort();
    } else await route.continue();
  });
  page.on('pageerror', error => errors.push(error.message));
  await cdp.send('Performance.enable');
  await cdp.send('DOM.enable');
  try {
    do {
      for (const route of routes) {
        const navigationStart = Date.now();
        // Native full-document route transitions are part of this application's lifecycle.
        if (!samples.length) await page.goto(route);
        else {
          const link = page.locator(`a[href="${route}"]:visible`).first();
          if (await link.count()) await link.click();
          else await page.goto(route);
        }
        await expect(page).toHaveURL(`http://127.0.0.1:3107${route}`);
        await expect(page.locator('main').first()).toBeVisible();
        const latencyMs = Date.now() - navigationStart;
        // Real disclosure open/close events without submission or participation writes.
        const summary = page.locator('summary:visible').first();
        if (await summary.count()) { await summary.click(); await page.waitForTimeout(300); await summary.click(); }
        const more = page.getByRole('button', { name: 'More', exact: true });
        if (await more.isVisible()) { await more.click(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }
        await page.waitForTimeout(1000);
        const frame = await page.evaluate(async () => {
          if (document.visibilityState !== 'visible') throw new Error('Soak must remain foreground');
          return await new Promise<{ fps: number; canvases: number }>(resolve => {
            let count = 0, first = 0;
            const tick = (now: number) => {
              if (!first) first = now; else count++;
              if (now - first < 1000) requestAnimationFrame(tick);
              else resolve({ fps: count * 1000 / (now - first), canvases: document.querySelectorAll('canvas').length });
            };
            requestAnimationFrame(tick);
          });
        });
        await cdp.send('HeapProfiler.collectGarbage');
        const metrics = await cdp.send('Performance.getMetrics');
        const get = (name: string) => { const metric = metrics.metrics.find(m => m.name === name); if (!metric) throw new Error(`Missing metric ${name}`); return metric.value; };
        // Experimental Chromium API: fail rather than silently substitute total DOM nodes.
        const detached = await cdp.send('DOM.getDetachedDomNodes');
        samples.push({ route, seconds: (Date.now() - start) / 1000, heap: get('JSHeapUsedSize'), nodes: get('Nodes'), listeners: get('JSEventListeners'), detached: detached.detachedNodes.length, workers: page.workers().length, latencyMs, ...frame });
      }
    } while (Date.now() - start < duration * 1000);
    completed = true;
    // Compare matching routes after a full warm-up loop; medians suppress one-off GC noise.
    for (const route of routes) {
      const rows = samples.filter(s => s.route === route).slice(1);
      expect(rows.length, `insufficient samples: ${route}`).toBeGreaterThanOrEqual(6);
      const early = rows.slice(0, 3), late = rows.slice(-3);
      for (const [metric, absolute, relative] of [['heap', 10 * 1024 * 1024, .2], ['nodes', 100, .1], ['listeners', 20, .1], ['detached', 5, 0], ['workers', 0, 0]] as const) {
        const before = median(early.map(s => s[metric])), after = median(late.map(s => s[metric]));
        expect(after - before, `${route} ${metric}`).toBeLessThanOrEqual(Math.max(absolute, before * relative));
      }
      expect(median(late.map(s => s.fps)), `${route} FPS`).toBeGreaterThanOrEqual(median(early.map(s => s.fps)) * .85);
    }
    expect(errors).toEqual([]);
    expect(blocked.filter(s => !s.startsWith('GET '))).toEqual([]);
  } finally {
    await info.attach('memory-soak.json', { body: JSON.stringify({ duration, completed, acceptanceDuration: duration === 1800 && completed, browser: browser.version(), platform: process.platform, samples, errors, blocked, limitations: 'Dedicated page workers only; detached node roots (not retained subtree size); rAF scheduling FPS; unconfigured maps/worlds are not GPU coverage.' }, null, 2), contentType: 'application/json' });
    try { await cdp.detach(); } finally { await context.close(); }
    expect(context.pages()).toHaveLength(0);
  }
});
