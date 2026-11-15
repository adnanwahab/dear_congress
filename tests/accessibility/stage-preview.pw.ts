import { test, expect } from '@playwright/test';

test('stage lens stays inert, dismisses, and preserves the destination identity', async ({ page }) => {
  let writes = 0;
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes++; });
  await page.goto('/feed?proposal=sample-identity&topic=housing');
  const link = page.locator('.bottom-destinations a').filter({ hasText: 'Votes' });
  const href = await link.getAttribute('href');
  await link.focus();
  await expect(page.getByRole('status').filter({ hasText: 'Stage 3' })).toBeVisible();
  await expect(page.locator('.stage-peek-window :is(a,input,form,iframe)')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.stage-peek-window')).toHaveCount(0);
  expect(await link.getAttribute('href')).toBe(href);
  await expect(page).toHaveURL(/\/feed\?/);
  expect(writes).toBe(0);
  await link.click();
  await expect(page).toHaveURL(new RegExp('/votes\\?'));
  expect(writes).toBe(0);
});

test('failed lazy summary keeps the real link available without submission', async ({ page }) => {
  let writes = 0;
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes++; });
  await page.route('**/*stage-preview-data*', route => route.abort());
  await page.goto('/feed');
  const link = page.locator('.bottom-destinations a').filter({ hasText: 'Votes' });
  await link.focus();
  await expect(page.getByRole('status').filter({ hasText: 'Preview unavailable' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.stage-peek-window')).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(/\/votes$/);
  expect(writes).toBe(0);
});
