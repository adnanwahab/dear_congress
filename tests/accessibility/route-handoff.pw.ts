import { test, expect } from '@playwright/test';

for (const failure of [false, true]) test(`native route handoff ${failure ? 'failed snapshot' : 'success'}`, async ({ page }) => {
  let writes = 0;
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes++; });
  if (failure) await page.addInitScript(() => {
    // Exercise a rejected visual promise through the production lifecycle handler.
    window.addEventListener('load', () => window.dispatchEvent(Object.assign(new Event('pagereveal'), {
      activation: { from: { url: location.origin + '/feed' }, entry: { url: location.href } },
      viewTransition: { types: new Set(), skipTransition() {}, ready: Promise.reject(new Error('snapshot unavailable')), finished: Promise.reject(new Error('snapshot unavailable')) },
    })));
  });
  await page.goto('/feed?motion=slow');
  await page.locator('.bottom-destinations a[href="/votes"]').click();
  await expect(page).toHaveURL(/\/votes$/);
  await expect(page.locator('main h1')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/feed\?motion=slow&proposal=demo-housing$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/votes$/);
  await expect(page.locator('main h1')).toBeVisible();
  await page.locator('.bottom-destinations a[href="/draft"]').focus();
  await expect(page.locator('.bottom-destinations a[href="/draft"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/draft(?:\?[^#]*)?$/);
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => {
    // Several taps within one task while the incoming transition is still live.
    for (const href of ['/feed', '/votes', '/draft'])
      (document.querySelector(`.bottom-destinations a[href="${href}"]`) as HTMLAnchorElement).click();
  });
  await expect(page).toHaveURL(/\/draft(?:\?[^#]*)?$/);
  await expect(page.locator('.bottom-destinations a[aria-current="page"]')).toHaveAttribute('href', '/draft');
  expect(writes).toBe(0);
});
