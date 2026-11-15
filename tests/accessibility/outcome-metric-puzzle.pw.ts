import { test, expect } from '@playwright/test';

// Both journeys operate a disposable local server. No participation writes allowed.
for (const mode of ['keyboard', 'touch'] as const) {
  test(`${mode} metric puzzle full journey and reset`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: mode === 'touch' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mode === 'touch' });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
    async function activate(name: string) {
      const target = page.getByRole('button', { name, exact: true });
      if (mode === 'touch') await target.tap();
      else {
        for (let i = 0; i < 100 && !(await target.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
        await expect(target).toBeFocused();
        await page.keyboard.press('Enter');
      }
    }
    await page.goto('/bills');
    await activate('Try the metric puzzle');
    for (let step = 0; step < 5; step++) {
      const select = page.locator('[data-metric-choice]');
      await expect(page.getByRole('heading', { name: new RegExp(`${step + 1} / 5`) })).toBeFocused();
      if (mode === 'touch') {
        await select.tap();
        await select.selectOption(String(step % 2));
        // Native OS select menus are platform-owned; selection uses the browser API.
      } else {
        await page.keyboard.press('Tab');
        await expect(select).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      await activate('Continue');
    }
    await expect(page.getByRole('heading', { name: 'Your metric review' })).toBeFocused();
    await expect(page.locator('.outcome-metric-puzzle dl > div')).toHaveCount(5);
    await activate('Restart');
    await expect(page.locator('[data-metric-choice]')).toHaveValue('');
    await activate('Skip');
    await expect(page.getByRole('heading', { name: '2 / 5 · Measure' })).toBeFocused();
    await activate('Exit puzzle');
    await expect(page.getByRole('button', { name: 'Try the metric puzzle', exact: true })).toBeFocused();
    const summary = page.getByText('Complete-text explanation', { exact: true });
    if (mode === 'touch') await summary.tap();
    else { await page.keyboard.press('Tab'); await expect(summary).toBeFocused(); await page.keyboard.press('Enter'); }
    await expect(page.getByText('Staff decide after seeing the results.', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(writes).toEqual([]);
    await context.close();
  });
}

test('workflow and tour entry points retain local isolation', async ({ page }) => {
  await page.goto('/outcomes');
  await page.getByRole('button', { name: 'Try the metric puzzle', exact: true }).click();
  await expect(page.locator('[data-metric-choice]')).toBeVisible();
  await page.goto('/votes?demo=1&step=2&paused=1');
  await page.getByRole('button', { name: 'Try the metric puzzle', exact: true }).click();
  await expect(page.getByRole('button', { name: '▶ Resume', exact: true })).toBeDisabled();
  await page.locator('[data-metric-choice]').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/step=2/);
  await page.getByRole('button', { name: 'Exit puzzle', exact: true }).click();
  await expect(page.getByRole('button', { name: '▶ Resume', exact: true })).toBeEnabled();
});
