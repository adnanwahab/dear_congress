import { test, expect } from '@playwright/test';

test('surprise explorer keyboard, pointer, no writes and stable focus', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET') writes.push(r.url()); });
  await page.goto('/');
  const explorer = page.getByRole('region', { name: 'Follow your curiosity' });
  const button = explorer.getByRole('button', { name: 'Surprise me', exact: true });
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(explorer.locator('article')).toBeVisible();
  const first = await explorer.locator('article h3').textContent();
  await expect(button).toBeFocused();
  await page.keyboard.press('Space');
  await expect(explorer.locator('article h3')).not.toHaveText(first!);
  await page.keyboard.press('Tab');
  await expect(explorer.locator('article a')).toBeFocused();
  await button.click();
  await expect(explorer.locator('article')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toEqual([]);
});
