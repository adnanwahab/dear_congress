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
  const reflow = await page.evaluate(() => {
    const selectors = ['html', 'body', '.product-shell', '.topic-hubs', '.constellation', '.constellation-viewport', '.bottom-bar', '.bottom-utilities', '.bottom-destinations', '.civic-header'];
    const elements = selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) return { selector, missing: true };
      const rect = el.getBoundingClientRect();
      return { selector, left: Math.round(rect.left), right: Math.round(rect.right), scroll: el.scrollWidth, client: el.clientWidth, overflowX: getComputedStyle(el).overflowX };
    });
    return { width: window.innerWidth, scroll: document.documentElement.scrollWidth, elements };
  });
  expect(reflow.scroll <= reflow.width, JSON.stringify(reflow, null, 2)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
