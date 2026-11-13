import { strict as assert } from 'node:assert';

/** GET-only parity contract. Never records response bodies, cookies or exception text. */
export async function verifyRelease(origin: string | undefined, expected: string | undefined, request: typeof fetch = fetch) {
  assert.ok(origin && /^https?:\/\//.test(origin), 'Supply the release origin');
  const base = new URL(origin);
  assert.ok(!base.username && !base.password && base.pathname === '/' && !base.search && !base.hash, 'Supply a bare origin without credentials');
  assert.match(expected ?? '', /^[a-f0-9]{40}$/, 'Supply the intended full release SHA');
  const checks: { path: string; status: number | null; passed: boolean }[] = [];
  async function check(path: string, status: number, inspect: (response: Response) => Promise<void>) {
    const result = { path, status: null as number | null, passed: false };
    checks.push(result);
    try {
      const response = await request(new URL(path, base), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
      result.status = response.status;
      assert.equal(response.status, status);
      await inspect(response);
      result.passed = true;
    } catch { /* Allowlisted diagnostics only; no production bodies or error messages. */ }
  }
  await check('/version', 200, async response => {
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    const version = await response.json();
    assert.equal(version.commit, expected);
    assert.equal(version.environment, 'production');
    assert.equal(version.repository, 'https://github.com/adnanwahab/dear_congress');
    assert.match(version.builtAt ?? '', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(Number.isFinite(Date.parse(version.builtAt)));
  });
  for (const path of ['/', '/account', '/votes?proposal=demo-transit']) {
    await check(path, 200, async response => {
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      const html = await response.text();
      assert.ok(html.includes('id="root"'));
      assert.ok(html.includes(`data-build-commit="${expected}"`));
    });
  }
  await check('/privacy', 200, async response => {
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await response.text(), /Delete an entry or withdraw a vote/);
  });
  await check('/release-parity-unknown-route', 404, async () => {});
  return { passed: checks.every(check => check.passed), checks };
}
if (import.meta.main) {
  try {
    const report = await verifyRelease(...process.argv.slice(2) as [string, string]);
    await Bun.write('release-parity-http.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (!report.passed) throw new Error();
  } catch {
    console.error('NO-GO: release parity failed. Human release owner must investigate and consider rollback.');
    process.exitCode = 1;
  }
}
