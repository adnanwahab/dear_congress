import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('catalog keyboard search, categories, history and deep link', async ({ page }) => {
  let writes = 0;
  page.on('request', r => { if (r.method() === 'POST' && /\/(votes|citizen-proposals)/.test(r.url())) writes++; });
  async function activate(target: Locator) {
    for (let n = 0; n < 220; n++) {
      if (await target.evaluateAll(els => els.includes(document.activeElement!))) {
        await expect(target).toBeInViewport();
        await page.keyboard.press('Enter');
        return;
      }
      await page.keyboard.press('Tab');
    }
    throw new Error('Catalog control unreachable by keyboard');
  }
  await page.goto('/bills');
  await expect(page.locator('.bill-grid article')).toHaveCount(100);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const search = page.getByRole('searchbox', { name: 'Search bills' });
  for (let i = 0; i < 20 && !(await search.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.type('HFL-051');
  await expect(page.locator('.bill-grid article')).toHaveCount(1);
  await expect(search).toBeFocused();
  const share = page.url();
  await activate(page.getByRole('button', { name: 'Housing and livable cities', exact: true }));
  await expect(page.locator('main')).toContainText('No draft concepts match');
  await page.goBack();
  await expect(page.locator('.bill-grid article')).toHaveCount(1);
  await page.goForward();
  await expect(page.locator('.bill-grid article')).toHaveCount(0);
  await page.goto(share);
  await activate(page.getByRole('link', { name: /Explore proposal HFL-051/ }));
  await expect(page).toHaveURL(/\/bills\/HFL-051/);
  await expect(page.getByRole('heading', { name: 'Statutory text' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Unknown until assessed');
  await expect(page.locator('main')).toContainText('Advisory participation is unavailable');
  for (const route of ['/bills', '/bills/HFL-051']) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  }
  expect(writes).toBe(0);
});

test('governance prism retains selection, history and keyboard focus in reduced motion and static mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/bills/HFL-051?q=HFL-051&lens=0');
  const prism = page.getByRole('region', { name: 'Governance prism', exact: true });
  const next = prism.getByRole('button', { name: 'Rotate next lens' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(next).toBeFocused();
  await expect(prism.getByRole('region', { name: 'Law lens', exact: true })).toContainText('Hypothetical draft context');
  await expect(page).toHaveURL(/HFL-051\?q=HFL-051&lens=1/);
  expect(await prism.locator('.prism-shape').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.goBack();
  await expect(prism.getByRole('region', { name: 'Cost lens', exact: true })).toContainText('Missing data');
  await page.goForward();
  await expect(prism.getByRole('region', { name: 'Law lens', exact: true })).toBeVisible();
  await prism.getByRole('button', { name: 'Static / low-power view' }).click();
  await expect(prism.locator('.prism-shape')).toBeHidden();
  await next.click();
  await expect(prism.getByRole('region', { name: 'Time lens', exact: true })).toContainText('Missing data');
  await page.getByRole('link', { name: '← All 100 proposals' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search bills' })).toHaveValue('HFL-051');
  await expect(page.locator('.bill-grid article')).toHaveCount(1);
});
