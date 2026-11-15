import { expect, test } from '@playwright/test';

test('local discovery supports keyboard, narrow screens and reduced motion without a write', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.goto('/');
  const rail = page.getByRole('region', { name: 'My area’s civic challenges' });
  const locality = rail.getByRole('combobox', { name: 'Browse jurisdiction' });
  await expect(rail.getByText('12 policy examples for all jurisdictions.', { exact: true })).toBeVisible();
  await locality.focus();
  await locality.press('Home');
  await locality.press('ArrowDown');
  await locality.press('ArrowDown');
  await locality.press('ArrowDown');
  await locality.press('ArrowDown');
  await locality.press('Enter');
  await expect(locality).toHaveValue('Houston');
  await expect(rail.getByRole('link', { name: 'Explore this sample policy' })).toHaveCount(4);
  await rail.getByRole('combobox', { name: 'Policy category' }).selectOption('Transit');
  const link = rail.getByRole('link', { name: 'Explore this sample policy' });
  await expect(link).toHaveAttribute('href', '/feed?proposal=demo-streets');
  await link.focus();
  await link.press('Enter');
  await expect(page).toHaveURL(/\/feed\?proposal=demo-streets/);
  expect(writes).toEqual([]);
});

test('local discovery gives useful loading, failure and empty states', async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/demo', async route => { await hold; await route.abort(); });
  await page.goto('/');
  const rail = page.getByRole('region', { name: 'My area’s civic challenges' });
  await expect(rail.getByText('Loading policy examples…', { exact: true })).toBeVisible();
  release();
  await expect(rail.getByRole('alert')).toContainText('Could not refresh');
  await expect(rail.getByText('No examples match this scope.', { exact: false })).toBeVisible();
  await expect(rail.getByRole('link', { name: 'describe a challenge yourself' })).toHaveAttribute('href', '/journal');
});

test('local discovery controls have touch-sized targets', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:3107/');
    const rail = page.getByRole('region', { name: 'My area’s civic challenges' });
    await rail.getByRole('combobox', { name: 'Browse jurisdiction' }).selectOption('Texas');
    await rail.getByRole('button', { name: 'Clear jurisdiction preference' }).tap();
    await expect(rail.getByRole('combobox', { name: 'Browse jurisdiction' })).toHaveValue('');
    for (const control of await rail.locator('select, button, a').all()) {
      const box = await control.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await context.close(); }
});
