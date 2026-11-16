import { test, expect, type Page, type Locator } from '@playwright/test';

async function keyboardActivate(page: Page, target: Locator) {
  for (let i = 0; i < 200; i++) {
    if (await target.evaluate(el => el === document.activeElement)) { await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
  }
  throw new Error('Control unreachable by keyboard');
}
for (const mode of ['keyboard', 'touch'] as const) {
  test(`fictional budget shock complete ${mode} playthrough`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: mode === 'touch' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mode === 'touch' });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', r => { if (!['GET','HEAD'].includes(r.method())) writes.push(r.url()); });
    await page.goto('http://127.0.0.1:3107/bills');
    const exercise = page.getByRole('region', { name: 'Fictional budget shock exercise' });
    const activate = async (target: Locator) => mode === 'touch' ? await target.tap() : await keyboardActivate(page, target);
    const button = (name: string) => exercise.getByRole('button', { name, exact: true });
    await activate(button('Try fictional budget shock'));
    await expect(exercise.getByRole('heading')).toBeFocused();
    await activate(button('Reveal hypothetical shock'));
    await expect(exercise.getByRole('status')).toContainText('120 / 100');
    await activate(button('Explore below-minimum plan'));
    await expect(exercise.getByText('Protected minimum violated.', { exact: false })).toBeVisible();
    await expect(button('Inspect completed receipt')).toBeDisabled();
    await activate(button('Split reductions'));
    await expect(exercise.getByRole('status')).toContainText('100 / 100');
    await activate(button('Inspect completed receipt'));
    await expect(exercise).toContainText('Fictional exercise complete');
    await activate(button('Revise sandbox plan'));
    await activate(button('Use fictional one-time reserve'));
    await expect(exercise.getByRole('status')).toContainText('120 / 120');
    await activate(button('Inspect completed receipt'));
    await expect(exercise).toContainText('Reserve: 20 → 0');
    await activate(button('Restart'));
    await expect(exercise).toContainText('1. Starting assumptions');
    await activate(button('Skip'));
    await expect(button('Try fictional budget shock')).toBeFocused();
    await activate(exercise.locator('summary'));
    await expect(exercise.getByText(/Start with 100 invented tokens/)).toBeVisible();
    await activate(button('Try fictional budget shock'));
    await activate(button('Exit'));
    await expect(button('Try fictional budget shock')).toBeFocused();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.close();
  });
}
