import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('constellation keyboard, touch-sized controls, source preview and equivalent list', async ({ page }) => {
  await page.goto('/topics/housing');
  const graph = page.locator('.constellation');
  await expect(graph.getByRole('heading', { name: 'Curiosity constellation' })).toBeVisible();
  const node = graph.locator('.constellation-node').first();
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  await expect(graph.locator('.constellation-preview')).toContainText('Next step:');
  await expect(page).toHaveURL(/\/topics\/housing$/);
  await graph.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(graph.locator('output')).toHaveText('125%');
  const box = await node.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await graph.getByRole('button', { name: 'Show equivalent list' }).click();
  await expect(graph).toContainText('Defines measurement target');
  const reflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    docWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('*')]
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width && rect.right > innerWidth + 1)
      .slice(0, 20)
      .map(({ element, rect }) => ({
        tag: element.tagName,
        cls: typeof element.className === 'string' ? element.className.slice(0, 140) : '',
        width: Math.round(rect.width), left: Math.round(rect.left), right: Math.round(rect.right),
      })),
  }));
  console.log('REFLOW_DIAGNOSTICS', JSON.stringify(reflow));
  expect(reflow.docWidth <= reflow.viewport).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
