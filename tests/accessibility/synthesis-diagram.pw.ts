import { test, expect } from '@playwright/test';

test('assumption diagram calculates, fails honestly, and leaves navigation and publication separate', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && !r.url().endsWith('/api/synthesize')) writes.push(r.url()); });
  let fail = false;
  let cost = 10;
  await page.route('**/api/synthesize', async route => {
    expect(route.request().postDataJSON().preview).toBe(true);
    if (fail) return route.fulfill({ status: 503, json: { error: 'Calculation unavailable' } });
    // Deterministic package fixture; no real residents or public writes.
    const pkg = { id: 'A', name: 'Fixture', description: 'Synthetic fixture', scoreAudit: { version: 'score-arithmetic-v1', proposals: [] }, items: [], totalCost: cost, budget: 40, avgSupport: .5, avgChange: 0,
      deferred: [], blocked: [], emerging: [], waiting: [], ideas: [], unfundedPopularCost: 0,
      changesFromPrevious: { added: [], removed: [], moneyMovedB: 0 }, challengerStreak: {}, churnLimited: false };
    await route.fulfill({ json: { real: [pkg], blended: [], diff: {} } });
  });
  await page.goto('/synth');
  await page.getByText('Advanced synthesis, scoring and frozen plan comparisons', { exact: true }).click();
  await expect(page.locator('.controls')).toContainText('Live preview · not saved');
  // Wait for the first synthetic preview to render before changing assumptions.
  // Otherwise the new request can abort the baseline and no comparable figures exist.
  await expect(page.locator('.synthesis-package')).toHaveCount(1);
  const slider = page.locator('.controls input[type=range]').last();
  cost = 15;
  await slider.focus();
  await slider.press('ArrowRight');
  const diagram = page.getByRole('region', { name: 'Assumption to calculated figures' });
  await expect(diagram.getByRole('status')).toContainText('Changed fields: real package A spending ($B)');
  await expect(diagram.locator('[data-changed]')).toHaveCount(1);
  await expect(slider).toBeFocused();
  fail = true;
  await slider.press('ArrowRight');
  await expect(diagram.getByRole('status')).toContainText('Calculation unavailable');
  await expect(diagram.locator('[data-connected]')).toHaveCount(0);
  await page.goto('/needs');
  await expect(page).toHaveURL(/\/needs/);
  expect(writes).toEqual([]);
});
