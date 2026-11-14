import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { demoPayload } from '../../src/engine/demo';

// Existing typed fictional catalog; no browser activity is promoted to verified evidence.
export const sample = demoPayload({}, 'visual-fixture', new Date('2026-11-13T12:00:00Z'));
export const proposal = sample.items[0]!;
export const test = base.extend<{ noWrites: void }>({
  noWrites: [async ({ page }, use) => {
    const writes: string[] = [];
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) {
        writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
        await route.abort(); return;
      }
      if (new URL(request.url()).pathname === '/api/demo') {
        await route.fulfill({ json: sample }); return;
      }
      await route.continue();
    });
    await use();
    expect(writes, 'Browsing and playback must never submit votes or other API writes').toEqual([]);
  }, { auto: true }],
});
export { expect };
export async function activate(page: Page, target: Locator, info: TestInfo) {
  if (info.project.use.hasTouch) { await target.tap(); return; }
  // Exercise actual keyboard reachability, without programmatically focusing controls.
  for (let n = 0; n < 200; n++) {
    if (await target.evaluateAll(nodes => nodes.some(node => node === document.activeElement))) {
      await page.keyboard.press('Enter'); return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('Journey control is unreachable by keyboard');
}
export async function capture(page: Page, info: TestInfo, name: string, target = page.locator('main')) {
  await expect(target).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await info.attach(`${name}.png`, { body: await target.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await expect.soft(target).toHaveScreenshot(`${name}.png`, { animations: 'disabled', maxDiffPixels: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow').toBe(true);
}
