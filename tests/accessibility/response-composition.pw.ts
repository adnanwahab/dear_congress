import { test, expect } from '@playwright/test';

test('composition keyboard, offline, export and print', async ({ page, context }) => {
  await page.route('**/api/demo*', route => route.abort());
  await page.goto('/outcomes');
  const exercise = page.locator('#response-composition');
  await expect(exercise).toBeVisible();
  const slider = exercise.getByRole('slider').first();
  for (let i = 0; i < 100 && !(await slider.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(slider).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1.25');
  await context.setOffline(true);
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('5');
  await expect(exercise.getByRole('status')).toContainText('70.0%');
  const download = page.waitForEvent('download');
  await exercise.getByRole('button', { name: 'Export illustrative report' }).click();
  expect((await download).suggestedFilename()).toContain('illustrative');
  await page.emulateMedia({ media: 'print' });
  await expect(exercise.locator('.composition-print-report')).toBeVisible();
  await expect(exercise.locator('.composition-print-report')).toContainText('pending human review');
  expect(await exercise.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('touch sliders change illustrative composition', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3107/outcomes');
  const slider = page.locator('#response-composition input').first();
  const box = (await slider.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * .8, box.y + box.height / 2);
  expect(Number(await slider.inputValue())).toBeGreaterThan(1);
  await expect(page.locator('#response-composition [role=status]')).not.toContainText('50.0%');
  await context.close();
});
