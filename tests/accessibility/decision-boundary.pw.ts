import { test, expect } from '@playwright/test';

test('fixture brush supports keyboard thresholds without public submissions', async ({ page }) => {
  const posts: { path: string; preview?: boolean }[] = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push({ path: new URL(request.url()).pathname, preview: request.postDataJSON()?.preview }); });
  await page.goto('/synth');
  await page.getByText('Advanced synthesis, scoring and frozen plan comparisons', { exact: true }).click();
  await page.getByRole('button', { name: 'Compare rule in sandbox' }).click();
  await expect(page.getByText('Fixture comparison ready.', { exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Balanced · spend' }).click();
  const brush = page.getByRole('region', { name: 'Balanced decision boundary', exact: true });
  const slider = brush.getByRole('slider');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('1');
  await expect(brush.getByRole('status')).toContainText('Score ≥');
  await expect(brush.locator('[data-highlighted=true]').first()).toBeVisible();
  await slider.press('End');
  await expect(brush.getByText('End of score list')).toBeVisible();
  await slider.press('Home');
  await expect(brush.getByRole('status')).toContainText('no policies highlighted');
  await brush.getByRole('button', { name: 'Next score threshold' }).click();
  await expect(slider).toHaveValue('1');
  await page.goto('/needs');
  await expect(page).toHaveURL(/\/needs$/);
  expect(posts.every(({ path, preview }) => path === '/api/synthesis-rule-preview' || (path === '/api/synthesize' && preview === true))).toBe(true);
});

test('failed fixture request recovers and navigation discards an interrupted request', async ({ page }) => {
  await page.route('**/api/synthesis-rule-preview', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture preview unavailable' }) }));
  await page.goto('/synth');
  await page.getByText('Advanced synthesis, scoring and frozen plan comparisons', { exact: true }).click();
  await page.getByRole('button', { name: 'Compare rule in sandbox' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Fixture preview unavailable' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Sweep score boundary' })).toHaveCount(0);
  await page.unroute('**/api/synthesis-rule-preview');
  await page.getByRole('button', { name: 'Compare rule in sandbox' }).click();
  await expect(page.getByText('Fixture comparison ready.', { exact: true })).toBeVisible();
  await page.route('**/api/synthesis-rule-preview', async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.abort(); });
  await page.getByRole('button', { name: 'Compare rule in sandbox' }).click();
  await page.goto('/needs');
  await expect(page).toHaveURL(/\/needs$/);
  await expect(page.getByRole('slider', { name: 'Sweep score boundary' })).toHaveCount(0);
});
