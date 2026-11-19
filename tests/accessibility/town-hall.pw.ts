import { test, expect, type Page } from '@playwright/test';
import { HALL_SCENES } from '../../src/client/town-hall-scenes';

async function keyboardActivate(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  for (let i = 0; i < 300; i++) {
    if (await button.evaluate(el => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
}
for (const touch of [false, true]) test(`town hall full ${touch ? 'touch' : 'keyboard'} playthrough`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: touch, viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const writes: string[] = [];
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.goto('/bills/HFL-051');
  const activate = async (name: string) => touch ? page.getByRole('button', { name, exact: true }).tap() : keyboardActivate(page, name);
  await activate('Start town-hall practice');
  for (const [i, pick] of [0, 1, 0].entries()) {
    await expect(page.getByRole('heading', { name: `Fictional scene ${i + 1} of 3: ${HALL_SCENES[i]!.title}` })).toBeFocused();
    await activate(HALL_SCENES[i]!.choices[pick]![0]);
    await expect(page.locator('#townhall [role=status]')).toContainText(HALL_SCENES[i]!.choices[pick]![1]);
    await activate('Next scene');
  }
  await expect(page.locator('#townhall')).toContainText('3 of 3 opportunities');
  await activate('Restart');
  for (let i = 0; i < 3; i++) await activate('Skip scene');
  await expect(page.locator('#townhall')).toContainText('3 skipped');
  await activate('Exit practice');
  await expect(page.getByRole('button', { name: 'Start town-hall practice' })).toBeFocused();
  const summary = page.locator('#townhall summary');
  if (touch) await summary.tap();
  else { await page.keyboard.press('Tab'); await expect(summary).toBeFocused(); await page.keyboard.press('Enter'); }
  await expect(page.locator('#townhall details')).toHaveAttribute('open', '');
  await expect(page.locator('#townhall details')).toContainText('Fair procedure does not require consensus');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toEqual([]);
  await context.close();
});
