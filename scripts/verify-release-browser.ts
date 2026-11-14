import assert from 'node:assert/strict';
import { verifyRelease } from './verify-release';

// Install the pinned browser harness separately; it never enters the app image.
const modulePath = process.env.PLAYWRIGHT_MODULE;
const [origin, sha] = process.argv.slice(2);
let browser: any;
let stage = 'http';
const completed: string[] = [];
try {
  assert.ok((await verifyRelease(origin, sha)).passed);
  assert.ok(modulePath, 'PLAYWRIGHT_MODULE is required');
  const { chromium } = await import(modulePath);
  browser = await chromium.launch();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    // No production writes, telemetry, votes, verification or journal publication.
    await context.route('**/*', (route: any) => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let serverFailure = false;
    page.on('response', (response: any) => { if (response.status() >= 500) serverFailure = true; });
    const visit = async (path: string, status = 200) => {
      const response = await page.goto(new URL(path, origin).href);
      assert.equal(response?.status(), status);
    };
    stage = `${viewport.width}:home`;
    await visit('/');
    const start = page.getByRole('region', { name: 'Where would you like to start?' });
    await start.waitFor({ state: 'visible' });
    assert.equal(await start.getByRole('link').count(), 2);
    const explore = start.getByRole('link', { name: 'Explore a proposal & advisory vote' });
    await explore.waitFor({ state: 'visible' });
    assert.equal(await explore.getAttribute('href'), '/votes');
    assert.equal(await start.getByRole('link', { name: 'Tell us what needs fixing' }).getAttribute('href'), '/journal');
    await page.locator('a[href="/privacy"]').first().waitFor({ state: 'visible' });
    await explore.click();
    await page.waitForURL('**/votes');
    stage = `${viewport.width}:arguments`;
    await visit('/votes?proposal=demo-transit');
    const map = page.getByRole('region', { name: 'Compare arguments', exact: true });
    await map.getByRole('heading', { name: 'Reasons for', exact: true }).waitFor({ state: 'visible' });
    await map.getByRole('heading', { name: 'Concerns', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Unverified browser votes — advisory', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Synthetic demo data — illustrative', exact: true }).waitFor({ state: 'visible' });
    stage = `${viewport.width}:account`;
    await visit('/account');
    await page.getByRole('heading', { name: 'Participation & privacy' }).waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Verified eligible participants — advisory', exact: true }).waitFor({ state: 'visible' });
    assert.match(await page.getByRole('region', { name: 'Civic participation status' }).innerText(), /Not available/);
    await page.locator('a[href="/privacy"]').first().click();
    await page.waitForURL('**/privacy');
    await page.getByRole('heading', { name: 'Privacy & removal', exact: true }).waitFor({ state: 'visible' });
    stage = `${viewport.width}:routing`;
    await visit('/journal');
    await page.locator('#journal-excerpt').waitFor({ state: 'visible' });
    await visit('/release-parity-unknown-route', 404);
    assert.equal(serverFailure, false, 'A browser resource returned 5xx');
    completed.push(`${viewport.width}x${viewport.height}`);
    await context.close();
  }
  await Bun.write('release-parity-browser.json', JSON.stringify({ passed: true, completed }));
} catch {
  await Bun.write('release-parity-browser.json', JSON.stringify({ passed: false, stage, completed }));
  console.error('NO-GO: browser parity failed; human investigation and rollback decision required.');
  process.exitCode = 1;
} finally { await browser?.close(); }
