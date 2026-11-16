import assert from 'node:assert/strict';
import { CIVIC_STAGES, STAGES, stageRoute } from '../src/shared/civic-stages';

export function publicOrigin(value: string): string {
  const url = new URL(value);
  assert.ok(url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost'));
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  return url.origin;
}

/** Browser request firewall: no public writes, redirects to other origins, or telemetry. */
export function allowedRequest(origin: string, url: string, method: string): boolean {
  return new URL(url).origin === origin && ['GET', 'HEAD'].includes(method);
}

export async function probeJourney(origin: string, chromium: any) {
  const base = publicOrigin(origin);
  const browser = await chromium.launch();
  const checks: { path: string; expectedTitle: string; provenance: string; passed: boolean }[] = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', async (route: any) => {
      if (!allowedRequest(base, route.request().url(), route.request().method())) return route.abort();
      try {
        // Route handlers do not re-run for every redirect hop. Reject redirects
        // before the browser can follow one beyond the allowed origin.
        const response = await route.fetch({ maxRedirects: 0, timeout: 15000 });
        if (response.status() >= 300 && response.status() < 400) return route.abort();
        await route.fulfill({ response });
      } catch { await route.abort(); }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    for (const stage of CIVIC_STAGES) {
      const check = { path: stage.route, expectedTitle: `${stage.title} | Civic Synthesis`, provenance: 'Fictional proposals, illustrative tallies, and browser-local sponsor progress.', passed: false };
      checks.push(check);
      try {
        const response = await page.goto(new URL(stageRoute(stage.route.slice(1) as keyof typeof STAGES, 'demo-transit'), base).href);
        assert.equal(response?.status(), 200);
        assert.equal(await page.title(), check.expectedTitle);
        await page.getByRole('heading', { name: stage.title, exact: true, level: 1 }).waitFor();
        await page.getByText(check.provenance, { exact: false }).waitFor();
        // Loaded proposal data, not just the shell or a fallback error state.
        await page.getByText(/Demo activity date .*not a source check/).waitFor();
        if (stage.route === '/votes') {
          await page.getByRole('heading', { name: 'Unverified browser votes — advisory', exact: true }).waitFor();
          await page.getByRole('heading', { name: 'Synthetic demo data — illustrative', exact: true }).waitFor();
        }
        const next = page.locator('.workflow-next');
        assert.equal(await next.getAttribute('href'), stageRoute(stage.next, 'demo-transit'));
        await next.click();
        await page.waitForURL(new URL(stageRoute(stage.next, 'demo-transit'), base).href);
        await page.getByRole('heading', { name: STAGES[stage.next].title, exact: true, level: 1 }).waitFor();
        check.passed = true;
      } catch { /* Only fixed contract diagnostics; never retain public content or cookies. */ }
    }
    const journal = { path: '/journal', expectedTitle: 'Journal | Civic Synthesis', provenance: 'Public excerpts appear under public submissions; sample and simulated entries are separate.', passed: false };
    checks.push(journal);
    try {
      assert.equal((await page.goto(`${base}/journal`))?.status(), 200);
      assert.equal(await page.title(), journal.expectedTitle);
      await page.locator('#journal-excerpt').waitFor();
      await page.getByText(journal.provenance, { exact: false }).waitFor();
      await page.getByRole('heading', { name: 'Shared journal', exact: true }).waitFor();
      await page.locator('.journal-feed[aria-busy="false"]').waitFor();
      assert.equal(await page.locator('.dashboard-alert').count(), 0);
      journal.passed = true;
    } catch { /* No raw browser errors or page bodies in artifacts. */ }
    return { passed: checks.every(c => c.passed), checks };
  } finally { await browser.close(); }
}

if (import.meta.main) {
  let report: unknown = { passed: false, error: 'Probe setup failed' };
  try {
    assert.ok(process.env.PLAYWRIGHT_MODULE);
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
    const result = await probeJourney(process.argv[2] ?? '', chromium);
    report = result;
    if (!result.passed) process.exitCode = 1;
  } catch { process.exitCode = 1; }
  await Bun.write('synthetic-public.json', JSON.stringify(report, null, 2));
}
