import { test, expect } from '@playwright/test';

test('county selection becomes a focused data row without changing filters or writing', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.goto('/map');
  await page.getByRole('searchbox', { name: 'Find a county' }).fill('06037');
  await page.locator('.county-shape').filter({ has: page.locator('title', { hasText: 'Los Angeles County, CA' }) }).click();
  await page.getByRole('button', { name: 'Not evaluated', exact: false }).filter({ has: page.locator('b') }).click();
  const list = page.getByRole('button', { name: 'List view (map-free)', exact: true });
  await list.focus();
  await page.keyboard.press('Enter');
  const row = page.locator('.county-evidence-table tbody tr');
  await expect(row).toBeFocused();
  await expect(row).toContainText('Los Angeles County, CA · 06037');
  await expect(row).toContainText('Not evaluated');
  await expect(page.locator('.county-svg')).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveValue('06037');
  await expect(page.locator('.county-legend button[aria-pressed="true"]')).toContainText('Not evaluated');
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Map view', exact: true })).toBeFocused();
  await expect(page.locator('.county-shape[style*="county-model-06037"]')).toHaveCount(1);
  expect(writes).toEqual([]);
});

test('failed visual API and empty results preserve a map-free selected row', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.goto('/map');
  await page.evaluate(() => { document.startViewTransition = (() => { throw new Error('snapshot unavailable'); }) as typeof document.startViewTransition; });
  await page.getByRole('searchbox').fill('no county matches');
  await page.getByRole('button', { name: 'List view (map-free)', exact: true }).click();
  await expect(page.locator('.county-evidence-table tbody tr')).toBeFocused();
  await expect(page.locator('.county-evidence-table')).toContainText('48201');
  await expect(page.getByText('The selected county is outside the current filters. Filters have not changed.')).toBeVisible();
  await expect(page.getByText('No matching counties. Try another name or clear the model filter.')).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveValue('no county matches');
  // Ordinary chapter navigation remains usable after a failed visual enhancement.
  await page.goto('/needs');
  await expect(page.locator('main h1')).toBeVisible();
  expect(writes).toEqual([]);
});
