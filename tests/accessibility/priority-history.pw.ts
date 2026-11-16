import { test, expect } from '@playwright/test';

const snapshot = {
  recordedAt: '2026-11-14T00:00:00.000Z',
  source: 'dear-congress/shared-needs-v1',
  journals: 0, realJournals: 0, sampleJournals: 0, simulatedPrior: 60,
  allocations: 0, measuredOutcomes: false,
  ranks: [{ id: 'housing', label: 'Housing', rank: 1, demand: 0.5 }],
};

test('priority history reads recorded samples, filters dates and navigates without public submission', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', req => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) writes.push(req.url()); });
  await page.route('**/api/priority-history', route => route.fulfill({ status: 200, json: { samples: [snapshot] } }));
  await page.goto('/needs');
  const disclosure = page.getByText('Priority time machine', { exact: true });
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.priority-history label').filter({ hasText: 'Recorded snapshot' }).locator('select')).toBeVisible();
  await expect(page.locator('.priority-history')).toContainText('only one recorded snapshot');
  await page.getByLabel('From date').fill('2099-01-01');
  await expect(page.locator('.priority-history')).toContainText('No recorded snapshots');
  await page.getByLabel('From date').fill('');
  await expect(page.locator('.priority-history table')).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).first().click();
  await page.goBack();
  await expect(page).toHaveURL(/\/needs$/);
  expect(writes).toEqual([]);
});

test('priority history failure offers retry without submitting', async ({ page }) => {
  let fail = true;
  const writes: string[] = [];
  page.on('request', req => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) writes.push(req.url()); });
  await page.route('**/api/priority-history', async route => {
    if (fail) await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    else await route.fulfill({ status: 200, json: { samples: [snapshot] } });
  });
  await page.goto('/needs');
  await page.getByText('Priority time machine', { exact: true }).click();
  await expect(page.locator('.priority-history [role=alert]')).toContainText('unavailable');
  fail = false;
  await page.getByRole('button', { name: 'Retry history' }).click();
  await expect(page.locator('.priority-history label').filter({ hasText: 'Recorded snapshot' }).locator('select')).toBeVisible();
  expect(writes).toEqual([]);
});
