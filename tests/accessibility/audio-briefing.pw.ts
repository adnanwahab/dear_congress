import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('briefing controls and transcript remain usable across access modes', async ({ page, browser }, testInfo) => {
  let writes = 0;
  page.on('request', r => { if (r.method() === 'POST' && /\/api\/(votes|citizen-proposals)/.test(r.url())) writes++; });
  // Deterministic UI checks; actual native voice and assistive technology are manual checks.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(public text: string) {} } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      speaking: false, pending: false,
      speak(u: any) { (window as any).briefingUtterance = u; },
      cancel() {}, pause() {}, resume() {},
    } });
  });
  await page.goto('/votes?proposal=demo-transit');
  const briefing = page.getByRole('region', { name: 'Two-minute demo briefing' });
  await expect(briefing).toContainText('Synthetic voice');
  const play = briefing.getByRole('button', { name: 'Play briefing', exact: true });
  await play.focus(); await page.keyboard.press('Enter');
  await expect(briefing.getByRole('status')).toContainText('Loading');
  await page.evaluate(() => (window as any).briefingUtterance.onstart());
  await page.keyboard.press('Tab');
  await expect(briefing.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(briefing.getByRole('status')).toContainText('Paused');
  await briefing.getByRole('button', { name: 'Resume', exact: true }).click();
  await briefing.getByLabel('Speed').selectOption('1.5');
  await expect(briefing.getByRole('status')).toContainText('Ready');
  await briefing.getByRole('button', { name: 'Listen from chapter 3', exact: true }).click();
  await page.evaluate(() => (window as any).briefingUtterance.onerror());
  await expect(briefing.getByRole('status')).toContainText('Audio could not play');
  await expect(briefing).toContainText('No operating budget');
  const clauseLink = briefing.getByRole('link', { name: 'Sample proposal clause 1', exact: true });
  const clauseHref = await clauseLink.getAttribute('href');
  expect(clauseHref).toMatch(/^#argument-/);
  await clauseLink.click();
  await expect(page.locator(`[id="${clauseHref!.slice(1)}"]`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  if (testInfo.project.name === 'mobile-390') {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touchPage = await context.newPage();
    await touchPage.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined }));
    await touchPage.goto('/votes?proposal=demo-transit');
    const transcript = touchPage.getByRole('region', { name: 'Two-minute demo briefing' });
    await expect(transcript).toContainText('Audio unavailable');
    const touchLink = transcript.getByRole('link', { name: 'Sample proposal clause 1', exact: true });
    const touchHref = await touchLink.getAttribute('href');
    expect(touchHref).toMatch(/^#argument-/);
    await touchLink.tap();
    await expect(touchPage.locator(`[id="${touchHref!.slice(1)}"]`)).toBeVisible();
    await context.close();
  }
  expect(writes).toBe(0);
});
