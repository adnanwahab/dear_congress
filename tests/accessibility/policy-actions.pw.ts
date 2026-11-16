import { test, expect } from '@playwright/test';

test('policy actions preserve loading, failure, keyboard and external boundaries', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/demo', async route => { await gate; await route.continue(); });
  await page.goto('/feed?proposal=demo-housing');
  await expect(page.locator('.policy-actions')).toHaveCount(0);
  release();
  const cards = page.locator('.policy-actions');
  await expect(cards).toHaveAttribute('data-proposal-id', 'demo-housing');
  const links = cards.getByRole('link');
  await expect(links).toHaveCount(3);
  await links.first().focus();
  await page.keyboard.press('Tab');
  await expect(links.nth(1)).toBeFocused();
  for (const link of await links.all()) {
    expect(await link.getAttribute('href')).toBe('https://www.houstontx.gov/council/');
    expect(await link.getAttribute('target')).toBe('_blank');
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute('**/api/demo');
  await page.route('**/api/demo', route => route.abort());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry loading proposals' })).toBeVisible();
  await expect(cards).toHaveCount(0);
});
