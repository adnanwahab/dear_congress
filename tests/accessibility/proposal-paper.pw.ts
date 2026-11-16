import { test, expect } from '@playwright/test';

test('paper disclosure preserves route, selection and separate public actions', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.goto('/feed?proposal=demo-housing');
  const paper = page.locator('.proposal-paper').first();
  const summary = paper.locator(':scope > summary');
  await expect(summary).toBeVisible();
  const url = page.url();
  const history = await page.evaluate(() => window.history.length);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(paper).toHaveAttribute('open', '');
  await expect(paper.getByRole('heading', { name: 'Proposed wording · fictional sample' })).toBeVisible();
  await paper.locator('.proposal-paper-body > p').first().evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  const selected = await page.evaluate(() => window.getSelection()?.toString());
  expect(selected?.length).toBeGreaterThan(0);
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await summary.click();
  await expect(paper).not.toHaveAttribute('open', '');
  await summary.click();
  await expect(paper).toHaveAttribute('open', '');
  await paper.getByRole('link', { name: 'Continue to sample draft →' }).click();
  await expect(page).toHaveURL(/\/draft\?proposal=/);
  expect(writes).toEqual([]);
});

test('failed snapshot still opens document and interrupted navigation stays usable', async ({ page }) => {
  await page.addInitScript(() => {
    document.startViewTransition = (() => { throw new Error('snapshot unavailable'); }) as typeof document.startViewTransition;
  });
  await page.goto('/feed?proposal=demo-housing');
  const paper = page.locator('.proposal-paper').first();
  await paper.locator(':scope > summary').click();
  await expect(paper).toHaveAttribute('open', '');
  await paper.getByRole('link', { name: 'Continue to sample draft →' }).click();
  await expect(page).toHaveURL(/\/draft\?proposal=/);
  await page.goBack();
  await expect(page.locator('.proposal-paper').first().locator('summary')).toBeVisible();
});
