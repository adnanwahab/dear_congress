import { test, expect } from '@playwright/test';
test.use({ hasTouch: true });

// Approximate full-severity vision simulations, for visual regression review.
// These do not reproduce any individual's vision or establish clinical accuracy.
const matrices = {
  protanopia: '.567 .433 0 0 0 .558 .442 0 0 0 0 .242 .758 0 0 0 0 0 1 0',
  deuteranopia: '.625 .375 0 0 0 .7 .3 0 0 0 0 .3 .7 0 0 0 0 0 1 0',
  tritanopia: '.95 .05 0 0 0 0 .433 .567 0 0 0 .475 .525 0 0 0 0 0 1 0',
  grayscale: '.213 .715 .072 0 0 .213 .715 .072 0 0 .213 .715 .072 0 0 0 0 0 1 0',
};
for (const [mode, matrix] of Object.entries(matrices)) test(`county redundant encodings: ${mode}`, async ({ page }, info) => {
  await page.goto('/map?motion=off');
  await page.getByRole('button', { name: 'Improve one revision', exact: true }).click();
  const metrics = await page.locator('.county-metrics').innerText();
  const selected = await page.locator('.county-selected').innerText();
  await page.evaluate(({ matrix }) => {
    const holder = document.createElement('div');
    holder.innerHTML = `<svg width="0" height="0" aria-hidden="true"><defs><filter id="vision-test"><feColorMatrix type="matrix" values="${matrix}"/></filter></defs></svg>`;
    document.body.append(holder);
    document.querySelector('main')!.style.filter = 'url(#vision-test)';
  }, { matrix });
  if (mode === 'grayscale') await page.emulateMedia({ media: 'print' });
  for (const label of ['○ Solid', '△ Diagonal', '□ Crosshatch', '◇ Dots']) {
    await expect(page.locator('.county-legend')).toContainText(label);
  }
  const fills = await page.locator('.county-shape').evaluateAll(els => [...new Set(els.map(el => el.getAttribute('fill')))]);
  expect(fills.every(fill => /^url\(#county-(agree|review|object|unevaluated)\)$/.test(fill!))).toBe(true);
  expect(fills.length).toBeGreaterThan(1);
  await expect(page.locator('.county-metrics')).toHaveText(metrics);
  await expect(page.locator('.county-selected')).toHaveText(selected);
  await info.attach(`${mode}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.emulateMedia({ media: 'screen' });
  const textView = page.getByRole('button', { name: 'Use text-only county view', exact: true });
  await textView.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.county-shape')).toHaveCount(0);
  await expect(page.locator('.county-selected')).toHaveText(selected);
  await expect(page.locator('.county-metrics')).toHaveText(metrics);
  await page.getByRole('searchbox', { name: 'Find a county' }).fill('48201');
  const county = page.locator('.county-results button').first();
  await expect(county).toContainText('Harris County, TX');
  await county.tap();
  await expect(page.locator('.county-selected')).toContainText('48201');
  await expect(page.locator('.county-legend svg rect')).toHaveCount(4);
});
