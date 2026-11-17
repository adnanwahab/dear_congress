import { test, expect } from '@playwright/test';

test('fixture keyboard, sheet and static information contract', async ({ page }, info) => {
  let writes = 0;
  page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes++; });
  await page.goto('/playground?motion=off');
  const group = page.getByRole('group', { name: 'Sample state' });
  const gallery = page.locator('.playground-grid');
  const original = await gallery.innerText();
  for (const state of ['Success', 'Pending', 'Blocked', 'Offline', 'Synthetic', 'Empty']) {
    const button = group.getByRole('button', { name: state, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('main [role="status"]')).toContainText(state);
    expect(await gallery.innerText()).toBe(original);
  }
  await page.getByLabel('Static preview / low power').check();
  const open = page.getByRole('button', { name: 'Open sample sheet', exact: true });
  await open.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Sample sheet', exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close sample sheet' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible(); await expect(open).toBeFocused();
  // Pointer activation uses the same control and information as keyboard.
  await group.getByRole('button', { name: 'Offline', exact: true }).click();
  await expect(page.locator('main [role="status"]')).toContainText('Nothing has been sent.');
  const source = gallery.locator('summary').first();
  await source.focus(); await page.keyboard.press('Space');
  await expect(gallery.locator('details').first()).toHaveAttribute('open', '');
  expect(writes).toBe(0);
  expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await info.attach('playground.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});
