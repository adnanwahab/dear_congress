import { test, expect } from '@playwright/test';

for (const direction of ['rtl', 'ltr']) test(`layout preview ${direction} preserves content and numeric controls`, async ({ page }) => {
  await page.goto(`/account?layout=${direction}&motion=off`);
  await expect(page.locator('html')).toHaveAttribute('dir', direction);
  const select = page.getByLabel('Reading direction');
  await expect(select).toHaveValue(direction);
  await expect(page.getByRole('heading', { name: 'Participation & privacy' })).toBeVisible();
  await select.selectOption(direction === 'rtl' ? 'ltr' : 'rtl');
  await expect(select).toBeFocused();
  // Removing the query uses the saved tab preference.
  await page.goto('/account');
  await expect(page.locator('html')).toHaveAttribute('dir', direction === 'rtl' ? 'ltr' : 'rtl');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'range'; input.setAttribute('aria-label', 'Numeric fixture');
    document.querySelector('main')!.append(input);
  });
  await expect(page.getByLabel('Numeric fixture')).toHaveCSS('direction', 'ltr');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
