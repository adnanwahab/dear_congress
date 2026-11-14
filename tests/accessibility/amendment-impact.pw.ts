import { test, expect } from '@playwright/test';

test('private impact comparison keyboard, touch-sized controls and reduced motion', async ({ page }) => {
  let writes = 0;
  page.on('request', r => { if (r.method() !== 'GET') writes++; });
  await page.goto('/draft');
  const editor = page.getByRole('region', { name: 'Private amendment preparation' });
  await editor.getByRole('button', { name: 'Suggest amendment', exact: true }).click();
  const replacement = editor.getByLabel('Suggested replacement text');
  await replacement.fill('Scope: Evening transit pilot\nEligibility: All residents\nCost: Unknown\nImplementation: Needs assessment\nUncertainties: Uptake unknown');
  await editor.getByLabel('Rationale', { exact: true }).fill('Compare options');
  await editor.getByLabel('Impact / cost note (unknown is acceptable)').fill('Unknown');
  await editor.getByLabel(/^Citation note/).fill('Unverified author note');
  const save = editor.getByRole('button', { name: 'Save new private version' });
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('status')).toContainText('New private version saved');
  await replacement.fill('Scope: Evening transit pilot\nCost: Assessment pending');
  await save.click();
  const compare = editor.getByRole('region', { name: 'Compare saved revision IDs' });
  const before = compare.getByLabel('Before revision ID');
  const after = compare.getByLabel('After revision ID');
  await before.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await after.selectOption({ index: 2 });
  await expect(compare).toContainText('Scope · Needs review');
  await expect(compare).toContainText('No effect inferred');
  const anchor = compare.getByRole('link').first();
  await anchor.focus();
  await page.keyboard.press('Enter');
  const targetId = (await anchor.getAttribute('href'))!.slice(1);
  const target = page.locator(`[id="${targetId}"]`);
  await expect(target).toBeFocused();
  for (const control of [before, after, save]) {
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    expect(await compare.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  }
  expect(writes).toBe(0);
});
