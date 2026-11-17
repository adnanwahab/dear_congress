import { test, expect } from '@playwright/test';

for (const mode of ['keyboard', 'touch'] as const) {
  test(`${mode} complete fictional permit journey preserves participation`, async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3107', viewport: mode === 'touch' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mode === 'touch' });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
    async function activate(name: string) {
      const button = page.getByRole('button', { name, exact: true });
      if (mode === 'touch') await button.tap();
      else {
        for (let i = 0; i < 100 && !await button.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        await page.keyboard.press('Enter');
      }
    }
    try {
      await page.goto('/bills');
      await activate('Play permit escape room');
      const dialog = page.getByRole('dialog', { name: 'Fictional permit escape room' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('never changes city services');
      for (const permit of ['Building', 'Electrical', 'Mechanical']) await activate(`Recover ${permit} permit`);
      await activate('Review conflicting rules');
      await activate('Follow the old memo');
      await expect(dialog.getByRole('status')).toContainText('conflicts');
      await activate('Confirm the current checklist with the coordinator');
      await activate('Open Tuesday to beat the deadline');
      await expect(dialog.getByRole('status')).toContainText('incomplete');
      await activate('Finish trade work → inspection → occupancy review → Friday opening if approved');
      await expect(dialog.getByRole('heading', { name: 'Fictional backlog untangled' })).toBeVisible();
      const explanation = dialog.locator('summary');
      if (mode === 'touch') await explanation.tap();
      else {
        for (let i = 0; i < 100 && !await explanation.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
        await expect(explanation).toBeFocused();
        await page.keyboard.press('Enter');
      }
      await expect(dialog.getByRole('heading', { name: 'Entire fictional story and solution' })).toBeVisible();
      await activate('Restart puzzle');
      await expect(dialog).toContainText('0 of 3 fictional permits recovered');
      await activate('Skip puzzle');
      await expect(dialog.getByRole('status')).toContainText('skipped');
      await activate('Exit puzzle');
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Play permit escape room' })).toBeFocused();
      await activate('Play permit escape room');
      await expect(dialog).toContainText('0 of 3 fictional permits recovered');
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      expect(writes).toEqual([]);
      await page.goto('/feed');
      await expect(page.getByRole('button', { name: 'Play permit escape room' })).toBeVisible();
      await page.goto('/votes?demo=1&step=2&paused=1');
      await activate('Play permit escape room');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('region', { name: 'Guided demo controls' })).toBeVisible();
      expect(writes).toEqual([]);
    } finally { await context.close(); }
  });
}
