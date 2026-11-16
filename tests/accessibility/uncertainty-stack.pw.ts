import { expect, test } from '@playwright/test';

test('uncertainty keyboard, API failure, offline, export and print fallbacks', async ({ page, context }) => {
  await page.route('**/api/demo*', route => route.abort());
  await page.goto('/outcomes');
  const stack = page.locator('.uncertainty-stack');
  await expect(stack).toBeVisible();
  const select = stack.getByLabel('Example case');
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(stack.getByRole('status')).toContainText('No combined interval');
  await context.setOffline(true);
  await select.selectOption('missing');
  await expect(stack).toContainText('source missing');
  await select.selectOption('traceable');
  await expect(stack.getByRole('status')).toContainText('$198,000');
  const download = page.waitForEvent('download');
  await stack.getByRole('button', { name: 'Export uncertainty record' }).click();
  expect((await download).suggestedFilename()).toBe('uncertainty-traceable-v1.json');
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('unavailable'); }; });
  await stack.getByRole('button', { name: 'Export uncertainty record' }).click();
  await expect(stack.getByRole('alert')).toContainText('Copy the complete record');
  expect(JSON.parse(await stack.getByLabel('Complete uncertainty record').inputValue()).history[0].review).toBe('pending human review');
  await page.emulateMedia({ media: 'print' });
  await expect(stack.getByRole('status')).toBeVisible();
  await expect(stack.locator('li').first()).toBeVisible();
  await context.setOffline(false);
});

test('touch controls retain all four components at phone width', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3107/outcomes');
  const stack = page.locator('.uncertainty-stack');
  await stack.getByLabel('Example case').tap();
  await stack.getByLabel('Example case').selectOption('conflicting');
  await expect(stack.getByRole('status')).toContainText('Unresolved conflicting evidence');
  const reflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 && r.left < innerWidth && r.width > 1; }).slice(0, 12).map(el => ({
      tag: el.tagName, className: String(el.className).slice(0, 80), rect: (() => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; })(),
      maxWidth: getComputedStyle(el).maxWidth, overflowX: getComputedStyle(el).overflowX,
      ancestors: (() => { const p = []; for (let n: Element | null = el; n && p.length < 5; n = n.parentElement) p.push(n.tagName + '.' + String(n.className).slice(0, 35)); return p; })()
    }))
  }));
  expect(reflow.scrollWidth <= reflow.width, JSON.stringify(reflow)).toBe(true);
  await context.close();
});
