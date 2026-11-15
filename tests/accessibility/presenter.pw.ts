import { test, expect } from '@playwright/test';

test('presenter reveals, advances chapters and never submits', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/feed?presenter=1');
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
  await expect(page.getByText('Synthetic demonstration', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Blackout', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3 })).toBeHidden();
  await page.getByRole('button', { name: 'Reveal slide' }).click();
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom text' }).click();
  await expect(page.getByRole('button', { name: 'Zoom text' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Next slide' }).click();
  await expect(page).toHaveURL(/\/votes\?.*presenter=1/);
  await expect(page.getByRole('status')).toContainText('Slide 3 of 6');
  expect(writes).toEqual([]);
});

test('load and fullscreen failures recover without writes or trapped focus', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.route('**/api/demo', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/draft?presenter=1');
  await expect(page.getByRole('alert')).toContainText('Sample proposals unavailable');
  await page.unroute('**/api/demo');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
  await page.evaluate(() => { HTMLElement.prototype.requestFullscreen = () => Promise.reject(Error('denied')); });
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fullscreen unavailable');
  await page.getByRole('link', { name: 'Exit presentation' }).focus();
  await expect(page.getByRole('link', { name: 'Exit presentation' })).toBeFocused();
  expect(writes).toEqual([]);
});
