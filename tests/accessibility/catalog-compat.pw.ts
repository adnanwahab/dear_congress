import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('current catalog has one main heading for empty and selected states', async ({ page }) => {
  await page.goto('/votes?q=HFL-051&bill=HFL-051');
  await expect(page).toHaveURL(/\/votes\?q=HFL-051&bill=HFL-051$/);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Third Places for Everyone Act');
  await page.goto('/votes');
  await expect(page.locator('main h1')).toHaveText('Browse ideas for a better world.');
});

test('timeline markers retain accessible names with valid ARIA roles', async ({ page }) => {
  await page.goto('/visual-lab/latency');
  const markers = page.locator('.tl-marker');
  expect(await markers.count()).toBeGreaterThan(0);
  for (const marker of await markers.all()) {
    await expect(marker).toHaveAttribute('role', 'img');
    await expect(marker).toHaveAccessibleName(/at week \d+/);
  }
  const results = await new AxeBuilder({ page }).withRules(['aria-prohibited-attr']).analyze();
  expect(results.violations).toEqual([]);
});
