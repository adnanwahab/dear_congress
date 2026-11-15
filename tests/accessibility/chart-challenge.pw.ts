import { test, expect, type Page } from '@playwright/test';

async function keyboardActivate(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  for (let i = 0; i < 180; i++) {
    if (await button.evaluate(el => el === document.activeElement)) { await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Could not reach ${name} using Tab`);
}

test('keyboard-only chart challenge completes, skips, restarts and exits without writes', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.goto('/bills');
  await keyboardActivate(page, 'Catch the misleading chart · Play (optional)');
  await expect(page.getByRole('heading', { name: '1 / 3 · The towering increase' })).toBeFocused();
  const summary = page.locator('summary').filter({ hasText: 'Complete text explanation' });
  for (let i = 0; i < 25; i++) {
    if (await summary.evaluate(el => el === document.activeElement)) { await page.keyboard.press('Enter'); break; }
    await page.keyboard.press('Tab');
  }
  await expect(page.getByText('Ask: Where does the axis begin?')).toBeVisible();
  for (const flaw of ['Truncated axis', 'Denominator shift', 'Selection bias']) {
    await keyboardActivate(page, flaw);
    await expect(page.getByRole('table', { name: 'Complete fictional numerical data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Corrected chart' })).toBeVisible();
    await keyboardActivate(page, 'Next scene');
  }
  await expect(page.getByRole('heading', { name: 'Challenge complete' })).toBeFocused();
  await keyboardActivate(page, 'Restart');
  await keyboardActivate(page, 'Skip scene');
  await expect(page.getByRole('heading', { name: '2 / 3 · More responses, less context' })).toBeFocused();
  await keyboardActivate(page, 'Exit challenge');
  await expect(page.getByRole('button', { name: 'Catch the misleading chart · Play (optional)' })).toBeFocused();
  expect(writes).toEqual([]);
});

test('touch chart challenge full playthrough and tour isolation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  try {
    await page.goto('/bills');
    await page.getByRole('button', { name: 'Catch the misleading chart · Play (optional)' }).tap();
    for (const flaw of ['Truncated axis', 'Denominator shift', 'Selection bias']) {
      await page.getByRole('button', { name: flaw, exact: true }).tap();
      await expect(page.getByRole('table')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Next scene' }).tap();
    }
    await expect(page.getByRole('heading', { name: 'Challenge complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Restart', exact: true }).tap();
    await page.getByRole('button', { name: 'Skip scene' }).tap();
    await page.getByRole('button', { name: 'Exit challenge' }).tap();
    await page.goto('/votes');
    await expect(page.getByRole('button', { name: 'Catch the misleading chart · Play (optional)' })).toBeVisible();
    await page.goto('/votes?demo=1&step=2');
    const tour = page.getByRole('region', { name: 'Guided demo controls' });
    await tour.getByRole('button', { name: 'Catch the misleading chart · Play (optional)' }).tap();
    await expect(tour.getByText(/Votes.*Paused/)).toBeVisible();
    await tour.getByRole('button', { name: 'Reveal explanation' }).tap();
    await expect(tour.getByRole('table')).toBeVisible();
    await tour.getByRole('button', { name: 'Exit challenge' }).focus();
    await page.keyboard.press('Escape');
    await expect(tour.getByRole('button', { name: 'Catch the misleading chart · Play (optional)' })).toBeFocused();
    expect(writes).toEqual([]);
  } finally { await context.close(); }
});
