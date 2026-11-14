import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('catalog keyboard search, categories, history and deep link', async ({ page }) => {
  let writes = 0;
  page.on('request', r => { if (r.method() === 'POST' && /\/(votes|citizen-proposals)/.test(r.url())) writes++; });
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
  await page.getByRole('button', { name: 'Housing and livable cities', exact: true }).click();
  await expect(page.locator('main')).toContainText('No draft concepts match');
  await page.goBack();
  await expect(page.locator('.bill-grid article')).toHaveCount(1);
  await page.goForward();
  await expect(page.locator('.bill-grid article')).toHaveCount(0);
  await page.goto(share);
  await page.getByRole('link', { name: /Explore proposal HFL-051/ }).click();
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
