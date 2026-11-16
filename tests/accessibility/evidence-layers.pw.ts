import { test, expect } from '@playwright/test';
import { demoPayload } from '../../src/engine/demo';

test('peel evidence with keyboard and retain proposal through interrupted chapter navigation', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.route('**/api/demo', route => route.fulfill({ json: demoPayload({}, 'test') }));
  await page.goto('/votes?proposal=demo-food&motion=slow');
  const evidence = page.locator('section[aria-label="Scenario and background source"]').first();
  const methodology = evidence.getByText('Methodology · how this claim was assembled', { exact: true });
  await methodology.focus();
  await page.keyboard.press('Enter');
  await expect(evidence.getByText(/No study extraction/)).toBeVisible();
  const uncertainty = evidence.getByText('Uncertainty · what remains unknown', { exact: true });
  await uncertainty.focus();
  await page.keyboard.press('Space');
  await expect(evidence.getByText(/Effectiveness, costs/)).toBeVisible();
  await expect(evidence.locator('a')).toHaveAttribute('href', 'https://www.ers.usda.gov/data-products/food-access-research-atlas');
  expect(await evidence.evaluate(el => getComputedStyle(el.querySelector('.evidence-layers')!).userSelect)).toBe('text');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Leave while the slow enhancement may still be running. Native links own routing.
  await page.locator('.bottom-destinations a[href^="/draft"]').click();
  await expect(page).toHaveURL(/\/draft\?proposal=demo-food/);
  await expect(page.locator('main')).toContainText('Food Access Research Atlas');
  await page.goBack();
  await expect(page).toHaveURL(/\/votes\?proposal=demo-food/);
  await expect(page.locator('main')).toContainText('Sample scenario / not introduced bill');
  expect(writes).toEqual([]);
});

test('failed evidence load retries without turning an unsafe missing source into a fact or submission', async ({ page }) => {
  let fail = true;
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.route('**/api/demo', route => {
    if (fail) return route.fulfill({ status: 503, json: { error: 'Offline' } });
    const payload = demoPayload({}, 'test');
    payload.items = payload.items.map(item => ({ ...item, sourceUrl: 'javascript:alert(1)', background: undefined }));
    return route.fulfill({ json: payload });
  });
  await page.goto('/votes?proposal=demo-food');
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load sample proposals' })).toContainText('Could not load sample proposals');
  fail = false;
  await page.getByRole('alert').filter({ hasText: 'Could not load sample proposals' }).getByRole('button').click();
  const evidence = page.locator('section[aria-label="Scenario and background source"]').first();
  await expect(evidence).toContainText('Source not available / not checked');
  await expect(evidence.locator('a')).toHaveCount(0);
  await evidence.getByText('Methodology · how this claim was assembled', { exact: true }).click();
  await evidence.getByText('Uncertainty · what remains unknown', { exact: true }).click();
  await expect(evidence.getByText(/No replacement source/)).toBeVisible();
  await expect(evidence).toContainText('illustrative inference, not official fact');
  expect(writes).toEqual([]);
});
