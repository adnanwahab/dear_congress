import { test, expect } from '@playwright/test';

for (const mode of ['keyboard', 'touch'] as const) {
  test(`policy pinball complete ${mode} playthrough`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ hasTouch: mode === 'touch', viewport: { width: mode === 'touch' ? 390 : 1280, height: 900 } });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
    await page.goto(`${baseURL}/bills`);
    const panel = page.getByRole('region', { name: 'Policy systems pinball', exact: true });
    async function activate(name: string) {
      const button = panel.getByRole('button', { name, exact: true });
      if (mode === 'touch') await button.tap();
      else {
        for (let i = 0; i < 150 && !(await button.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        await page.keyboard.press('Enter');
      }
    }
    await activate('Play policy pinball · fictional learning game');
    await activate('Launch token');
    for (const gate of ['Jurisdiction', 'Evidence', 'Implementation']) {
      await activate('Next bounce');
      await expect(panel.getByRole('status')).toContainText(gate);
    }
    await expect(panel.getByRole('status')).toContainText('Playthrough complete');
    const explanation = panel.getByText('Complete text explanation and all rule cards');
    if (mode === 'touch') await explanation.tap();
    else {
      for (let i = 0; i < 30 && !(await explanation.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expect(explanation).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(panel.locator('details')).toHaveAttribute('open', '');
    // Complete text remains available independently of visual path.
    await expect(panel.locator('details')).toContainText('staffing');
    if (mode === 'touch') await activate('Restart');
    else {
      // The details summary follows the controls in DOM order. Reverse-tab from
      // the expanded summary so the test exercises real keyboard navigation,
      // rather than traversing the entire bill catalog before looping around.
      const restart = panel.getByRole('button', { name: 'Restart', exact: true });
      for (let i = 0; i < 4 && !(await restart.evaluate(el => el === document.activeElement)); i++) {
        await page.keyboard.press('Shift+Tab');
      }
      await expect(restart).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(panel.getByRole('status')).toContainText('Ready to launch');
    await activate('Skip');
    await expect(panel.getByRole('button').first()).toBeFocused();
    await activate('Play policy pinball · fictional learning game');
    await activate('Exit');
    expect(writes).toEqual([]);
    await context.close();
  });
}

test('pinball is opt-in at each entry and pauses tour', async ({ page }) => {
  for (const route of ['/bills', '/votes', '/votes?demo=1&paused=1']) {
    await page.goto(route);
    const panel = page.getByRole('region', { name: 'Policy systems pinball', exact: true }).last();
    await expect(panel.getByRole('status')).toHaveCount(0);
    await panel.getByRole('button').first().click();
    await expect(panel.getByRole('status')).toContainText('Ready to launch');
    await panel.getByRole('button', { name: 'Launch token', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(panel.getByRole('status')).toContainText('Budget');
    if (route.includes('demo=1')) await expect(page.getByRole('region', { name: 'Guided demo controls' })).toContainText('Paused');
  }
});
