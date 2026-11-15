import { test, expect } from '@playwright/test';

const routes = ['/', '/feed', '/votes', '/needs', '/synth', '/map', '/outcomes'];
test('reality lens works by keyboard across routes without writes', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await page.goto('/');
  const explain = page.getByRole('button', { name: 'Explain data', exact: true });
  for (let n = 0; n < 40 && !(await explain.evaluate(el => el === document.activeElement)); n++) await page.keyboard.press('Tab');
  await expect(explain).toBeFocused();
  const priorWrites = writes.length;
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Less detail', exact: true })).toHaveAttribute('aria-expanded', 'true');
  expect(writes.slice(priorWrites), 'Changing Reality lens must not issue network writes').toEqual([]);
  for (const route of routes) {
    await page.goto(route);
    const legend = page.getByRole('region', { name: 'Reality lens', exact: true });
    await expect(legend).toBeVisible();
    await expect(legend.getByRole('button', { name: 'Less detail' })).toHaveAttribute('aria-expanded', 'true');
    await expect(legend.getByText('Seeded examples', { exact: true })).toBeVisible();
    await expect(legend.getByText('Missing or mixed origin', { exact: true })).toBeVisible();
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('*')].filter(element => {
        const box = element.getBoundingClientRect();
        return box.right > innerWidth + 1 && box.left < innerWidth && box.width > 1;
      }).slice(0, 8).map(element => ({ tag: element.tagName, className: String(element.className).slice(0, 90), width: Math.round(element.getBoundingClientRect().width), right: Math.round(element.getBoundingClientRect().right) }))
    }));
    expect(layout.scrollWidth <= layout.width, `Overflow on ${route}: ${JSON.stringify(layout)}`).toBe(true);
  }
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
