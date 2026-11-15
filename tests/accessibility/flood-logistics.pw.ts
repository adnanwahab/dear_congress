import { test, expect, type Page, type Locator } from '@playwright/test';

async function keyboardActivate(page: Page, target: Locator) {
  for (let n = 0; n < 160; n++) {
    if (await target.evaluate(el => el === document.activeElement)) { await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
  }
  throw new Error('Control unreachable by Tab');
}
for (const mode of ['keyboard', 'touch'] as const) {
  test(`fictional flood full ${mode} playthrough preserves participation`, async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3107', hasTouch: mode === 'touch', viewport: mode === 'touch' ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
    await page.goto('/bills');
    const game = page.getByRole('region', { name: 'Fictional flood logistics exercise' });
    const activate = async (target: Locator) => mode === 'touch' ? target.tap() : keyboardActivate(page, target);
    await activate(game.getByRole('button', { name: 'Start fictional exercise' }));
    await activate(game.locator('summary'));
    await expect(game).toContainText('not a forecast');
    await activate(game.locator('summary'));
    for (let round = 1; round <= 3; round++) {
      await expect(game).toContainText(`Hypothetical scene ${round} of 3`);
      await activate(game.getByRole('button', { name: 'Place crew at Willow homes', exact: true }));
      await expect(game.getByRole('button', { name: 'Place crew at Orchard workshop', exact: true })).toBeDisabled();
      await activate(game.getByRole('button', { name: 'Run hypothetical round', exact: true }));
    }
    await expect(game).toContainText('Fictional exercise complete');
    await expect(game.getByRole('listitem')).toHaveCount(3);
    await expect(game).toContainText('Willow homes: 4 remaining disruption units');
    await activate(game.getByRole('button', { name: 'Restart exercise' }));
    await expect(game).toContainText('No rounds run yet.');
    await activate(game.getByRole('button', { name: 'Skip round' }));
    await expect(game).toContainText('skipped; no resources placed');
    await activate(game.getByRole('button', { name: 'Exit exercise' }));
    await expect(game.getByRole('button', { name: 'Start fictional exercise' })).toBeVisible();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.close();
  });
}
