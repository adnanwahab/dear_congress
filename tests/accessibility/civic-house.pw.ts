import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('house enters a stage, restores its URL and focus without submissions', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.goto('/?house=1');
  await expect(page.getByRole('status').filter({ hasText: 'Previewing fictional sample:' })).toBeVisible();
  await expect(page.locator('.house-room')).toHaveCount(6);
  const orbit = page.getByRole('button', { name: 'Orbitable 3D view' });
  if (await orbit.isEnabled()) {
    await orbit.click();
    const slider = page.getByRole('slider', { name: 'Orbit the house' });
    await slider.focus(); await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('1');
    await page.getByRole('button', { name: 'Flat grid · no motion / low GPU' }).click();
  }
  await page.getByRole('link', { name: 'Enter Draft →', exact: true }).click();
  await expect(page).toHaveURL(/\/draft\?proposal=demo-housing/);
  await expect(page.locator('#stage-heading')).toBeVisible();
  await page.locator('#stage-heading').focus();
  await page.goto('/?house=1');
  await expect(page.getByRole('link', { name: 'Enter Draft →', exact: true })).toHaveAttribute('href', '/draft?proposal=demo-housing');
  await page.getByRole('link', { name: 'Enter Draft →', exact: true }).click();
  await expect(page.locator('#stage-heading')).toBeFocused();
  expect(writes).toEqual([]);
});
test('failed previews retain accessible navigation and can retry', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.route('**/api/demo', r => r.abort());
  await page.goto('/?house=1');
  await expect(page.getByRole('status').filter({ hasText: 'Previews could not load' })).toBeVisible();
  await expect(page.locator('.house-room a')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.unroute('**/api/demo');
  await page.getByRole('button', { name: 'Retry previews' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Previewing fictional sample:' })).toBeVisible();
  await page.getByRole('link', { name: 'Enter Feed →', exact: true }).click();
  await expect(page).toHaveURL(/\/feed\?proposal=/);
  expect(writes).toEqual([]);
});
