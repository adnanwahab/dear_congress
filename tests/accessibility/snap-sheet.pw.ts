import { test, expect } from '@playwright/test';

test('comparison sizes retain source text, trap focus and return with Escape', async ({ page }) => {
  await page.goto('/votes');
  const trigger = page.getByRole('button', { name: 'Open comparison sheet', exact: true });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Understand the change', exact: true });
  await expect(sheet).toBeVisible();
  const original = await sheet.locator('.snap-sheet-content').innerText();
  for (const size of ['Small', 'Full', 'Half']) {
    await sheet.getByRole('button', { name: size, exact: true }).click();
    await expect(sheet.getByRole('button', { name: size, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await sheet.locator('.snap-sheet-content').innerText()).toBe(original);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});
