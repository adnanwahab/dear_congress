import { test, expect } from '@playwright/test';

test('procurement complete keyboard and touch journeys make no writes', async ({ browser }) => {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ hasTouch: touch, viewport: { width: touch ? 390 : 1440, height: 900 } });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
    await page.goto('/bills');
    const game = page.getByRole('region', { name: 'Fictional procurement learning game' });
    async function activate(name: string) {
      const button = game.getByRole('button', { name, exact: true });
      if (touch) await button.tap();
      else {
        for (let i = 0; i < 200 && !(await button.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        await page.keyboard.press('Enter');
      }
    }
    await activate('Play procurement game');
    await activate('Compare fictional bids');
    const radio = game.getByRole('radio').first();
    if (touch) await radio.tap();
    else {
      for (let i = 0; i < 200 && !(await radio.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expect(radio).toBeFocused();
      await page.keyboard.press('Space');
    }
    await activate('Review tradeoffs');
    await expect(game).toContainText('0/1 below');
    await activate('Restart');
    await activate('Skip');
    await expect(game).toContainText('Skipped without choosing');
    await activate('Exit');
    await expect(game.getByRole('button', { name: 'Play procurement game' })).toBeFocused();
    const explanation = game.locator('summary');
    if (touch) await explanation.tap();
    else { await page.keyboard.press('Tab'); await expect(explanation).toBeFocused(); await page.keyboard.press('Enter'); }
    await expect(game.getByText(/Low price, quality and speed can conflict/)).toBeVisible();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.close();
  }
});
