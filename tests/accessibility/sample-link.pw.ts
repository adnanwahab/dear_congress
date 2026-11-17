import { test, expect } from '@playwright/test';

test('375px share and copy have touch targets and honest success/error feedback', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let writes = 0;
  page.on('request', request => { if (request.method() !== 'GET') writes++; });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { (window as any).sharedSample = data; } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).copiedSample = text; } } });
  });
  await page.goto('/votes?proposal=demo-housing&journal=PRIVATE&stance=1#receipt');
  const region = page.getByRole('region', { name: 'Share advisory decision card' });
  const share = region.getByRole('button', { name: 'Share link', exact: true });
  const copy = region.getByRole('button', { name: 'Copy link', exact: true });
  for (const button of [share, copy]) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.99);
    expect(box!.width).toBeGreaterThanOrEqual(43.99);
  }
  await share.click();
  await expect(region.getByRole('status')).toContainText('Delivery is not verified');
  const payload = await page.evaluate(() => (window as any).sharedSample);
  expect(new URL(payload.url).search).toBe('?proposal=demo-housing');
  expect(JSON.stringify(payload)).not.toMatch(/PRIVATE|stance|receipt/);
  await copy.focus(); await page.keyboard.press('Enter');
  await expect(region.getByRole('status')).toContainText('Link copied');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined }); });
  await copy.click();
  await expect(region.getByRole('status')).toContainText('Could not copy automatically');
  await expect(region.getByLabel('Link to copy')).toHaveValue(payload.url);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toBe(0);
});
