import { test, expect } from '@playwright/test';

test('keyboard full playthrough and competing chain', async ({ page }) => {
  await page.goto('/bills');
  const lab = page.getByRole('region', { name: 'Causal domino laboratory' });
  const launcher = lab.getByRole('button', { name: 'Causal domino laboratory', exact: true });
  await launcher.focus();
  await page.keyboard.press('Enter');
  async function activate(name: string) {
    for (let i = 0; i < 100; i++) {
      if (await lab.getByRole('button', { name, exact: true }).evaluate(el => el === document.activeElement)) {
        await page.keyboard.press('Enter'); return;
      }
      await page.keyboard.press('Tab');
    }
    throw new Error(`Unreachable by keyboard: ${name}`);
  }
  await activate('Extend fictional library hours');
  await activate('Shift workers can visit after work');
  await activate('More residents use shared study space');
  await activate('Trigger chain');
  await expect(lab.getByRole('status')).toContainText('Hypothetical chain played');
  await activate('Resource pressure');
  await activate('Extend fictional library hours');
  await activate('Staff cover more evening shifts');
  await activate('Daytime programs lose staff time');
  await activate('Trigger chain');
  await expect(lab.getByRole('status')).toContainText('Hypothetical chain played');
  await activate('Restart');
  await expect(lab.getByRole('list', { name: 'Your mechanism chain' }).getByRole('listitem')).toHaveCount(0);
  await activate('Exit');
  await expect(launcher).toBeFocused();
});

test('touch full playthrough, blocked order, explanation and skip', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const writes: string[] = [];
  page.on('request', req => { if (!['GET', 'HEAD'].includes(req.method())) writes.push(req.url()); });
  await page.goto('http://127.0.0.1:3107/bills');
  const lab = page.getByRole('region', { name: 'Causal domino laboratory' });
  const tap = (name: string) => lab.getByRole('button', { name, exact: true }).tap();
  await tap('Causal domino laboratory');
  await tap('More residents use shared study space');
  await expect(lab.getByRole('button', { name: 'Trigger chain' })).toBeDisabled();
  await tap('Restart');
  await tap('Extend fictional library hours');
  await tap('Shift workers can visit after work');
  await tap('More residents use shared study space');
  await tap('Trigger chain');
  await expect(lab.getByRole('status')).toContainText('Hypothetical chain played');
  await lab.getByText('Complete text explanation', { exact: true }).tap();
  await expect(lab.getByText('New staffing funds or different schedules could prevent this chain.')).toBeVisible();
  await tap('Skip');
  await expect(lab.getByRole('button', { name: 'Causal domino laboratory' })).toHaveAttribute('aria-expanded', 'false');
  expect(writes).toEqual([]);
  await context.close();
});
