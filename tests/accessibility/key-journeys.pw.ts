import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Reach the target through the real tab order, including backward traversal after
// a dynamic update. Never use click(), focus(), or DOM-dispatched activation.
async function reach(page: Page, target: Locator, backwards = false) {
  for (let n = 0; n < 220; n++) {
    if (await target.evaluateAll(els => els.includes(document.activeElement!))) {
      await expect(target).toBeVisible();
      await expect(target).toBeInViewport();
      return;
    }
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard target unreachable: ${target}`);
}

const attemptedWrites = new WeakMap<Page, string[]>();

test.afterEach(async ({ page }, info) => {
  expect(attemptedWrites.get(page)).toEqual([]);
  if (info.status !== info.expectedStatus) return;
  const results = await new AxeBuilder({ page }).analyze();
  await info.attach('journey-axe.json', { body: JSON.stringify({ url: page.url(), project: info.project.name, results }, null, 2), contentType: 'application/json' });
  await info.attach('journey.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});

test.beforeEach(async ({ page }) => {
  // These journeys are local inspection/preview only. Fail on any attempted write,
  // including accidental model runs; do not contact external simulation providers.
  const writes: string[] = [];
  await page.route('**/*', async route => {
    const request = route.request();
    // Editing now debounces an existing read-only server preview. Validate its
    // exact flag; committed synthesis and every civic write remain forbidden.
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/synthesize' && request.postDataJSON()?.preview === true) {
      await route.continue();
    } else if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(request.url());
      await route.abort();
    } else await route.continue();
  });
  attemptedWrites.set(page, writes);
});

test('Home navigation exposes named destinations and mobile modal restores focus', async ({ page }) => {
  await page.goto('/');
  const more = page.getByRole('button', { name: 'More', exact: true });
  if (await more.isVisible()) {
    await reach(page, more);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'More destinations' });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Close more destinations' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(more).toBeFocused();
  }
  const feed = page.locator('.bottom-destinations a[href="/feed"]');
  await reach(page, feed);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/feed\?proposal=demo-housing$/);
  await expect(page.locator('main h1')).toBeVisible();
});

test('Journal exact excerpt preview requires consent and cancels without publishing', async ({ page }) => {
  await page.goto('/journal');
  const draft = page.getByRole('textbox', { name: 'Working draft (not uploaded)', exact: true });
  await reach(page, draft);
  await page.keyboard.type('Synthetic private working text.');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Public excerpt', exact: true })).toBeFocused();
  await page.keyboard.type('Synthetic public transit example.');
  await reach(page, page.getByRole('button', { name: 'Review public excerpt', exact: true }));
  await page.keyboard.press('Enter');
  const preview = page.getByRole('region', { name: 'Exact public preview' });
  await expect(preview).toContainText('Synthetic public transit example.');
  await expect(preview).not.toContainText('Synthetic private working text.');
  const share = page.getByRole('button', { name: 'Share publicly', exact: true });
  await expect(share).toBeDisabled();
  await reach(page, preview.getByRole('checkbox'));
  await page.keyboard.press('Space');
  await expect(share).toBeEnabled();
  await reach(page, page.getByRole('button', { name: 'Cancel sharing', exact: true }));
  await page.keyboard.press('Enter');
  await expect(preview).toHaveCount(0);
  await expect(draft).toHaveValue('Synthetic private working text.');
  await expect(page.getByRole('region', { name: 'Deliberate public sharing' }).getByRole('status')).toContainText('not saved or uploaded');
});

test('Map searchable county alternative exposes identity and synthetic requirements', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/map');
  const search = page.getByRole('searchbox', { name: 'Find a county' });
  await reach(page, search);
  await page.keyboard.type('48201');
  await expect(page.locator('.county-directory [role="status"]')).toContainText('1 /');
  const county = page.locator('.county-results button');
  await reach(page, county);
  await page.keyboard.press('Enter');
  await expect(county).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.county-selected')).toContainText('48201');
  await expect(page.locator('.county-selected')).toContainText('thresholds');
  await expect(page.locator('.county-selected')).toContainText('not a government decision');
  await reach(page, page.getByRole('button', { name: 'Improve one revision', exact: true }), true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.county-status[role="status"]')).toContainText('Revision 2');
  await expect(page.locator('.county-selected')).toContainText('Plan revision 2');
});

test('Synth keyboard parameter editing announces stale results with read-only previews', async ({ page }) => {
  await page.goto('/synth');
  const strength = page.getByRole('slider', { name: /Implementation strength/ });
  await reach(page, strength);
  await page.keyboard.press('Home');
  await expect(strength).toHaveValue('0');
  await page.keyboard.press('ArrowRight');
  await expect(strength).toHaveValue('25');
  await expect(page.getByRole('status').filter({ hasText: 'The input has changed.' })).toBeVisible();
  await page.keyboard.press('End');
  await expect(strength).toHaveValue('100');
  await expect(strength).toBeFocused();
});
