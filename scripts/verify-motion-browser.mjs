// Run against scripts/accessibility-server.ts (disposable local data only).
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import assert from 'node:assert/strict';
const { chromium, firefox, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.MOTION_TEST_ORIGIN || 'http://127.0.0.1:3107';
let unavailable = false;
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  let browser;
  try { browser = await engine.launch({ headless: true }); }
  catch (error) { console.error(`${name}: UNVERIFIED: ${error.message.split('\n')[0]}`); unavailable = true; continue; }
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ reducedMotion, hasTouch: true });
      const page = await context.newPage();
      for (const fallback of [false, true]) {
        await context.addInitScript(disabled => {
          if (disabled) Object.defineProperty(Document.prototype, 'startViewTransition', { configurable: true, value: undefined });
        }, fallback);
        await page.goto(origin + '/?motion=slow');
        const link = page.locator('a[href="/votes"]').first();
        await link.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL('**/votes');
        await page.goBack();
        await page.waitForURL(origin + '/?motion=slow');
        await page.goForward();
        await page.waitForURL('**/votes');
        // Interrupt a slow snapshot with another real document navigation.
        await page.goto(origin + '/feed?motion=slow');
        await page.goto(origin + '/votes?motion=slow');
        await page.locator('.skip-navigation').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');
        await page.goto(origin + '/?motion=slow');
        await page.locator('a[href="/votes"]').first().tap();
        await page.waitForURL('**/votes');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.motion), 'slow');
      }
      await context.close();
      console.log(`${name}: ${reducedMotion}: keyboard/touch, history, focus, interrupted navigation, forced unsupported API PASS`);
    }
  } finally { await browser.close(); }
}
if (unavailable) process.exitCode = 1;
