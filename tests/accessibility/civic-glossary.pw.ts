import { test, expect } from '@playwright/test';

test('civic glossary keeps reading position with keyboard and offline help', async ({ page }) => {
  await page.goto('/documentation');
  const trigger = page.getByRole('button', { name: 'Quorum', exact: true }).first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const position = await page.evaluate(() => window.scrollY);
  await page.context().setOffline(true);
  await page.keyboard.press('Enter');
  const definition = page.getByRole('dialog', { name: 'quorum definition' });
  await expect(definition).toBeVisible();
  await expect(definition).toContainText('Example:');
  await expect(definition).toContainText('Editorial');
  await page.keyboard.press('Tab');
  await expect(definition.getByRole('button', { name: 'Close definition' })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(definition).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
  await trigger.click();
  await definition.getByRole('button', { name: 'Close definition' }).click();
  await expect(trigger).toBeFocused();
  await page.context().setOffline(false);
});
