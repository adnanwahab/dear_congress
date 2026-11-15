import { test, expect } from '@playwright/test';

for (const mode of ['keyboard', 'touch'] as const) {
  test(`amendment jigsaw complete ${mode} playthrough`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
    await page.goto('http://127.0.0.1:3107/bills');
    const game = page.getByRole('region', { name: 'Fictional amendment jigsaw', exact: true });
    async function activate(locator: ReturnType<typeof page.getByRole>) {
      if (mode === 'touch') await locator.tap();
      else {
        for (let i = 0; i < 200 && !(await locator.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
        await expect(locator).toBeFocused();
        await page.keyboard.press('Space');
      }
    }
    await activate(game.getByRole('button', { name: 'Play amendment jigsaw' }));
    for (const group of ['Scope', 'Eligibility', 'Authority', 'Funding', 'Effective date']) {
      await activate(game.getByRole('group', { name: group, exact: true }).getByRole('radio').first());
    }
    await activate(game.getByRole('button', { name: 'Check assembly' }));
    await expect(game.getByRole('status')).toContainText('Internally consistent');
    await activate(game.locator('summary'));
    await expect(game.getByRole('heading', { name: 'Hypothetical amendment text' })).toBeVisible();
    await activate(game.getByRole('button', { name: 'Restart', exact: true }));
    await expect(game.locator('input:checked')).toHaveCount(0);
    await activate(game.getByRole('button', { name: 'Skip', exact: true }));
    await expect(game.getByRole('button', { name: 'Play amendment jigsaw' })).toBeFocused();
    await activate(game.getByRole('button', { name: 'Play amendment jigsaw' }));
    await activate(game.getByRole('button', { name: 'Exit jigsaw', exact: true }));
    expect(writes).toEqual([]);
    await context.close();
  });
}
