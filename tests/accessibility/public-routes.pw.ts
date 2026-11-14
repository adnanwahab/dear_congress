import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/feed', '/votes', '/published', '/journal', '/needs', '/synth', '/map', '/draft', '/sponsors', '/outcomes', '/documentation', '/account'];
for (const route of routes) test(`${route} accessibility evidence`, async ({ page }, info) => {
  await page.goto(route);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main h1').first()).toBeVisible();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('main h1')).toHaveCount(1);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  // The next tab stop must be visible and have a painted focus indicator.
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  expect(await focused.evaluate(el => {
    const css = getComputedStyle(el); return css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0;
  })).toBe(true);
  await page.waitForTimeout(350);
  const results = await new AxeBuilder({ page }).analyze();
  await info.attach('axe-results.json', { body: JSON.stringify({ route, project: info.project.name, results }, null, 2), contentType: 'application/json' });
  await info.attach('route.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});

test('keyboard advisory journey confirms once and returns', async ({ page }) => {
  let writes = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/votes') writes++; });
  await page.goto('/feed');
  // Reach controls through actual Tab presses; never click or programmatically focus.
  async function tabTo(selector: ReturnType<typeof page.getByRole>) {
    for (let n = 0; n < 180; n++) {
      if (await selector.evaluateAll(els => els.includes(document.activeElement!))) return;
      await page.keyboard.press('Tab');
    }
    throw new Error('Target unreachable by keyboard');
  }
  const search = page.getByRole('searchbox', { name: 'Search sample proposals', exact: true });
  await tabTo(search);
  await page.keyboard.type('housing');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.locator('.proposal-search [role="status"]').first()).toContainText('proposals');
  expect(writes).toBe(0);
  // Sample proposal links retain the selected source ID across civic stages.
  const proposal = page.locator('main a[href*="/votes?proposal="]').first();
  await tabTo(proposal);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/votes\?proposal=/);
  await expect(page.locator('main')).toContainText(/evidence/i);
  const support = page.getByRole('button', { name: /Cast advisory vote: Support/ });
  await tabTo(support);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Server confirmed advisory choice' })).toBeVisible();
  expect(writes).toBe(1);
  await page.goBack();
  await expect(search).toBeVisible();
  expect(writes).toBe(1);
});
