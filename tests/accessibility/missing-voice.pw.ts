import { test, expect } from '@playwright/test';

test('missing voice keyboard full playthrough and controls', async ({ page }) => {
  await page.goto('/bills/HFL-051');
  const game = page.getByRole('region', { name: 'Spot the missing voice', exact: true });
  const start = game.getByRole('button', { name: /Optional puzzle/ });
  // Reach the entry using only the keyboard.
  for (let i = 0; i < 60 && !(await start.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(start).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 3; i++) {
    await expect(game.getByRole('heading', { level: 2 })).toBeFocused();
    await page.keyboard.press('Tab'); // first radio
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab'); // reveal
    await page.keyboard.press('Enter');
    await expect(game.getByRole('status')).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
  }
  await expect(game).toContainText('Reflection complete');
  await page.keyboard.press('Tab'); // complete text
  await page.keyboard.press('Enter');
  await expect(game.getByRole('heading', { name: 'The online survey · Fictional' })).toBeVisible();
  await page.keyboard.press('Tab'); // restart
  await page.keyboard.press('Enter');
  await expect(game).toContainText('1 / 3');
  await page.keyboard.press('Tab'); // radio
  await page.keyboard.press('Tab'); // skip (reveal disabled)
  await page.keyboard.press('Enter');
  await expect(game).toContainText('2 / 3');
  // Tab from heading through radio, skip, text, restart, exit.
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await expect(game.getByRole('button', { name: 'Exit puzzle' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(start).toBeFocused();
  await expect(start).toHaveAttribute('aria-expanded', 'false');
});

test('missing voice touch full playthrough has no writes', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const writes: string[] = [];
  page.on('request', req => { if (req.method() !== 'GET') writes.push(req.url()); });
  await page.goto('http://127.0.0.1:3107/bills/HFL-051');
  const game = page.getByRole('region', { name: 'Spot the missing voice', exact: true });
  await game.getByRole('button', { name: /Optional puzzle/ }).tap();
  for (let i = 0; i < 3; i++) {
    await game.getByRole('radio').nth(1).tap();
    await game.getByRole('button', { name: 'Reveal explanation' }).tap();
    await expect(game.getByRole('status')).toBeVisible();
    await game.getByRole('button', { name: 'Next scene' }).tap();
  }
  await expect(game).toContainText('Reflection complete');
  await game.getByText('Complete text explanation · all scenes', { exact: true }).tap();
  await expect(game.getByRole('heading', { name: 'The online survey · Fictional' })).toBeVisible();
  await game.getByRole('button', { name: 'Restart puzzle' }).tap();
  await game.getByRole('button', { name: 'Skip scene' }).tap();
  await expect(game).toContainText('2 / 3');
  await game.getByRole('button', { name: 'Exit puzzle' }).tap();
  expect(writes).toEqual([]);
  await context.close();
});
