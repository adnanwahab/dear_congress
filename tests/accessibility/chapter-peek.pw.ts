import { test, expect } from '@playwright/test';

test('edge peek requires a separate explicit navigation action and never submits', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && new URL(request.url()).pathname.startsWith('/api/')) writes.push(request.url());
  });
  await page.goto('/feed?proposal=h_vouchers');
  const edge = page.getByRole('button', { name: 'Peek next stage: Votes' });
  const rect = await edge.boundingBox();
  if (!rect) throw new Error('Missing edge handle');
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  // Failure: a short pull returns to the current page without an open action.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 35, y, { steps: 5 });
  await expect(page.locator('.chapter-preview')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open stage: Votes' })).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.chapter-peek')).toHaveCount(0);
  await expect(page).toHaveURL(/\/feed\?proposal=h_vouchers$/);
  // Success: threshold release arms a link, but does not navigate itself.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/feed\?proposal=h_vouchers$/);
  await page.getByRole('link', { name: 'Open stage: Votes' }).click();
  await expect(page).toHaveURL(/\/votes\?proposal=h_vouchers$/);
  expect(writes).toEqual([]);
});

test('keyboard, cancellation, scroll isolation and interrupted previews', async ({ page }) => {
  await page.goto('/feed');
  const edge = page.getByRole('button', { name: 'Peek next stage: Votes' });
  await edge.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Votes preview ready' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.chapter-peek')).toHaveCount(0);
  await expect(edge).toBeFocused();
  const box = await edge.boundingBox();
  if (!box) throw new Error('Missing handle');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2);
  await edge.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await expect(page.locator('.chapter-peek')).toHaveCount(0);
  // A gesture on content is outside the handle and is never intercepted.
  await page.locator('main').dispatchEvent('pointerdown', { pointerId: 2, isPrimary: true, button: 0, clientX: 200, clientY: 350 });
  await page.locator('main').dispatchEvent('pointermove', { pointerId: 2, clientX: 90, clientY: 350 });
  await expect(page.locator('.chapter-peek')).toHaveCount(0);
  await edge.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.chapter-peek')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('.chapter-peek')).toHaveCount(0);
});
