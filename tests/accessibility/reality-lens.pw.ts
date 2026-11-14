import { test, expect } from '@playwright/test';

const routes = ['/', '/feed', '/votes', '/needs', '/synth', '/map', '/outcomes'];
test('reality lens works by keyboard across routes without writes', async ({ page }) => {
  let writes = 0;
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes++; });
  await page.goto('/');
  const explain = page.getByRole('button', { name: 'Explain data', exact: true });
  for (let n = 0; n < 40 && !(await explain.evaluate(el => el === document.activeElement)); n++) await page.keyboard.press('Tab');
  await expect(explain).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Less detail', exact: true })).toHaveAttribute('aria-expanded', 'true');
  for (const route of routes) {
    await page.goto(route);
    const legend = page.getByRole('region', { name: 'Reality lens', exact: true });
    await expect(legend).toBeVisible();
    await expect(legend.getByRole('button', { name: 'Less detail' })).toHaveAttribute('aria-expanded', 'true');
    await expect(legend.getByText('Seeded examples', { exact: true })).toBeVisible();
    await expect(legend.getByText('Missing or mixed origin', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(writes).toBe(0);
});

test('reality lens touch control retains preference on reload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3107/votes');
  const button = page.getByRole('button', { name: 'Explain data' });
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await button.tap();
  await expect(page.getByRole('button', { name: 'Less detail' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Less detail' })).toBeVisible();
  await context.close();
});
