import { test, expect } from '@playwright/test';

test.use({ hasTouch: true });

test('detective practice: keyboard, small viewport, static feedback and no writes', async ({ page }) => {
  let writes = 0;
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes++; });
  await page.goto('/votes?proposal=demo-transit');
  const game = page.getByRole('region', { name: 'Fact-check detective practice' });
  await expect(game).toBeVisible();
  const choice = game.getByRole('button', { name: 'Claim', exact: true });
  for (let n = 0; n < 150 && !(await choice.evaluate(el => el === document.activeElement)); n++) await page.keyboard.press('Tab');
  await expect(choice).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(game.getByRole('status')).toContainText('Teaching classification: Claim');
  await expect(game.getByRole('link')).toHaveAttribute('href', /congress.gov.*3684\/text\/enr/);
  await page.keyboard.press('Tab');
  // Native tab order includes the source link before Next case.
  for (let n = 0; n < 8 && !(await game.getByRole('button', { name: 'Next case' }).evaluate(el => el === document.activeElement)); n++) await page.keyboard.press('Tab');
  await expect(game.getByRole('button', { name: 'Next case' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(game.getByRole('heading', { name: 'Case 2 of 4' })).toBeFocused();
  await game.getByRole('button', { name: 'Inference', exact: true }).tap();
  await expect(game.getByRole('status')).toContainText('Teaching classification: Inference');
  expect(await game.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await game.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(writes).toBe(0);
});

test('proposal loading and failure never fabricate a practice result', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/demo*', async route => { await gate; await route.abort(); });
  await page.goto('/votes?proposal=demo-transit');
  await expect(page.locator('.fact-check-game')).toHaveCount(0);
  release();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load sample proposals' })).toBeVisible();
  await expect(page.locator('.fact-check-game')).toHaveCount(0);
  await page.unroute('**/api/demo*');
  await page.getByRole('button', { name: /Retry/ }).click();
  await expect(page.locator('.fact-check-game')).toBeVisible();
});
