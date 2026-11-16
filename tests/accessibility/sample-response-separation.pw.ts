import { test, expect } from '@playwright/test';

for (const width of [320, 390]) {
  test(`fictional samples stay separate from browser choices at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/votes?proposal=demo-housing');
    const choices = page.getByRole('region', { name: 'Unverified browser choices', exact: true });
    const graphic = page.locator('figure.fictional-response-graphic');
    await expect(choices).toBeVisible();
    await expect(graphic.getByRole('heading', { name: 'Fictional sample responses' })).toBeVisible();
    await expect(graphic).toContainText('not people or community turnout');
    await expect(graphic.locator('button')).toHaveCount(0);
    await expect(choices).toContainText('Fictional sample responses are excluded');
    expect(await graphic.getAttribute('aria-describedby')).toBeTruthy();
    for (const section of [choices, graphic]) {
      await section.scrollIntoViewIfNeeded();
      expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Read-only check: this test never casts a choice or starts a round.
  });
}
