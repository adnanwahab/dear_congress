import { test, expect } from '@playwright/test';

test('atlas keyboard filtering, offline reading, download and print', async ({ page, context }) => {
  await page.goto('/outcomes');
  const atlas = page.locator('#data-gaps-atlas');
  await expect(atlas.locator('.gap-grid > li')).toHaveCount(3);
  const jurisdiction = atlas.getByLabel('Jurisdiction', { exact: true });
  // Start from the focused atlas landmark, then verify the first filter is
  // reachable with a real Tab. Avoid traversing every preceding page control.
  await atlas.focus();
  await page.keyboard.press('Tab');
  await expect(jurisdiction).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(atlas.getByLabel('Topic', { exact: true })).toBeFocused();
  await atlas.getByLabel('Topic', { exact: true }).selectOption('Accessibility');
  await expect(atlas.getByRole('status')).toHaveText('1 of 3 research cases shown');
  await context.setOffline(true);
  await atlas.getByRole('button', { name: 'Reset filters' }).click();
  await expect(atlas.locator('.gap-grid > li')).toHaveCount(3);
  const downloadEvent = page.waitForEvent('download');
  await atlas.getByRole('button', { name: 'Export visible cases (JSON)' }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('public-data-gaps.json');
  await atlas.getByText('Export text and print fallback', { exact: true }).click();
  await expect(atlas.locator('pre')).toContainText('Pending human review');
  await page.emulateMedia({ media: 'print' });
  await expect(atlas.locator('.gap-controls')).toBeHidden();
  await expect(atlas.locator('.gap-grid')).toBeVisible();
  expect(await atlas.locator('.gap-grid').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await context.setOffline(false);
});

test('atlas touch controls and reflow at 390px', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3107/outcomes');
  const atlas = page.locator('#data-gaps-atlas');
  await atlas.getByLabel('Topic', { exact: true }).selectOption('Accessibility');
  await atlas.getByRole('button', { name: 'Reset filters' }).tap();
  await expect(atlas.locator('.gap-grid > li')).toHaveCount(3);
  await atlas.getByText('Export text and print fallback', { exact: true }).tap();
  await expect(atlas.locator('pre')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});
