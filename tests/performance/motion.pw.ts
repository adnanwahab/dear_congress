import { test, expect } from '@playwright/test';
import { MOTION_BUDGET } from '../../src/client/motion';

// Chromium/CDP is deliberate: layer count is not exposed by portable web APIs.
for (const reduced of [false, true]) test(`route budget, reduced=${reduced}`, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let peakLayers = 0;
  cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => { peakLayers = Math.max(peakLayers, layers?.length ?? 0); });
  await cdp.send('LayerTree.enable');
  await page.addInitScript(() => {
    const frames: number[] = [], tasks: { start: number; duration: number }[] = [], inputs: number[] = [];
    Object.assign(window, { motionEvidence: { frames, tasks, inputs } });
    const start = performance.now(); let last = 0;
    function frame(now: number) {
      if (last) frames.push(now - last);
      last = now;
      if (now - start < 1200) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask' });
    new PerformanceObserver(list => inputs.push(...list.getEntries().map(e => e.duration))).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
  });
  const reports = [];
  for (const route of ['/', '/feed', '/votes']) {
    peakLayers = 0;
    if (route === '/') await page.goto(route);
    else await page.locator(`a[href="${route}"]:visible`).first().tap();
    await expect(page).toHaveURL(new RegExp(`${route === '/' ? '/' : route}$`));
    await expect(page.locator('main h1').first()).toBeVisible();
    // Real keyboard and touch events, read-only controls only.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.locator('main h1').first().tap();
    await page.waitForTimeout(1300);
    const evidence = await page.evaluate(() => (window as unknown as { motionEvidence: { frames: number[]; tasks: { start: number; duration: number }[]; inputs: number[] } }).motionEvidence);
    const sorted = evidence.frames.toSorted((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * .95)] ?? Infinity;
    const report = { route, reduced, p95, peakLayers, ...evidence };
    reports.push(report);
    await info.attach(`motion-${reports.length}.json`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    expect(sorted.length).toBeGreaterThan(10);
    expect(p95).toBeLessThanOrEqual(MOTION_BUDGET.frameMs);
    expect(Math.max(0, ...evidence.inputs)).toBeLessThanOrEqual(MOTION_BUDGET.inputMs);
    // Initial shell load allows up to 200ms per task; steady-state motion gets no >50ms task.
    expect(Math.max(0, ...evidence.tasks.map(t => t.duration))).toBeLessThanOrEqual(200);
    expect(Math.max(0, ...evidence.tasks.filter(t => t.start > 1000).map(t => t.duration))).toBeLessThanOrEqual(MOTION_BUDGET.longTaskMs);
    expect(peakLayers).toBeGreaterThan(0);
    expect(peakLayers).toBeLessThanOrEqual(MOTION_BUDGET.layers);
  }
  await info.attach('motion.json', { body: JSON.stringify(reports, null, 2), contentType: 'application/json' });
});

test('battery constraints keep empty search usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getBattery', { value: async () => Object.assign(new EventTarget(), { charging: false, level: .1 }) });
  });
  await page.goto('/feed');
  await expect(page.locator('html')).toHaveAttribute('data-motion-budget', 'constrained');
  const search = page.getByRole('searchbox', { name: 'Search sample proposals', exact: true });
  await search.fill('zzzzzzzzzz');
  await expect(page.locator('.proposal-search')).toContainText(/no .*proposals|0 proposals/i);
  await search.fill('');
  await expect(page.locator('main h1').first()).toBeVisible();
});

test('constrained loading and error states preserve retry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/demo', async route => { await pending; await route.fulfill({ status: 503, body: '{}' }); });
  await page.goto('/feed');
  await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
  expect(await page.locator('.skeleton').first().evaluate(el => getComputedStyle(el.querySelector('span > span')!, '::after').animationName)).toBe('none');
  release();
  await expect(page.getByRole('button', { name: /Retry loading proposals/ })).toBeVisible();
  await page.unroute('**/api/demo');
  await page.getByRole('button', { name: /Retry loading proposals/ }).tap();
  await expect(page.getByRole('searchbox', { name: 'Search sample proposals', exact: true })).toBeVisible();
});
