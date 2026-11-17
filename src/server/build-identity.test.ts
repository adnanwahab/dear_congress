import { expect, test } from "bun:test";
import { sanitizeBuild } from "./build-identity";
import { renderPage } from "./pages";

test("build diagnostics allowlist fields and reject malformed identity", () => {
  expect(sanitizeBuild({ commit: '<script>secret</script>', builtAt: 'secret', ADMIN_TOKEN: 'secret' })).toEqual({
    commit: null, builtAt: null, release: null, repository: 'https://github.com/adnanwahab/dear_congress', mode: 'demo',
  });
  const current = sanitizeBuild({ commit: 'a'.repeat(40), builtAt: '2026-11-13T12:00:00.000Z' });
  const rollback = sanitizeBuild({ commit: 'b'.repeat(40), builtAt: '2026-11-12T12:00:00.000Z' });
  expect(current.commit).not.toBe(rollback.commit);
  expect(current.builtAt).not.toBe(rollback.builtAt);
});

test("shell renders build diagnostics outside the React root", async () => {
  const html = await renderPage('<html><body><div id="root"></div></body></html>', '/', []).text();
  expect(html).toContain('<div id="root"></div>');
  expect(html).toContain('href="/version"');
  expect(html).toContain('data-build-commit=');
});

 test("release identity is allowlisted and cannot expose arbitrary manifest fields", () => {
  const identity = sanitizeBuild({ commit: 'a'.repeat(40), builtAt: '2026-11-13T12:00:00.000Z', release: 'v2026.11.16', FLY_API_TOKEN: 'secret' });
  expect(identity.release).toBe('v2026.11.16');
  expect(Object.isFrozen(identity)).toBe(true);
  expect(JSON.stringify(identity)).not.toContain('secret');
  for (const release of ['<script>secret</script>', 'vtag/secret', 'v' + 'x'.repeat(128), 42]) {
    expect(sanitizeBuild({ release }).release).toBeNull();
  }
});

test("generated image identity survives runtime overrides and omits secrets", async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'she805-'));
  try {
    await mkdir(join(root, 'src/server'), { recursive: true });
    await mkdir(join(root, 'scripts'));
    await copyFile(new URL('./build-identity.ts', import.meta.url), join(root, 'src/server/build-identity.ts'));
    await copyFile(new URL('../../scripts/write-build-identity.ts', import.meta.url), join(root, 'scripts/write-build-identity.ts'));
    const env = { ...process.env, BUILD_COMMIT: 'a'.repeat(40), BUILD_RELEASE: 'v2026.11.16', ADMIN_TOKEN: 'private-test-token' };
    const build = Bun.spawn([process.execPath, 'scripts/write-build-identity.ts'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' });
    expect(await build.exited).toBe(0);
    const manifest = await Bun.file(join(root, 'build-identity.json')).json();
    const run = Bun.spawn([process.execPath, '-e', 'import {buildIdentity} from "./src/server/build-identity.ts"; console.log(JSON.stringify(buildIdentity))'], {
      cwd: root, env: { ...env, BUILD_COMMIT: 'b'.repeat(40), BUILD_RELEASE: 'vwrong', NODE_ENV: 'production', FLY_RELEASE_VERSION: 'v123' }, stdout: 'pipe', stderr: 'pipe',
    });
    const identity = JSON.parse(await new Response(run.stdout).text());
    expect(await run.exited).toBe(0);
    expect(identity).toEqual({ ...manifest, environment: 'production', flyRelease: 'v123' });
    expect(identity.commit).toBe('a'.repeat(40));
    expect(identity.release).toBe('v2026.11.16');
    expect(JSON.stringify(identity)).not.toContain('private-test-token');
  } finally { await rm(root, { recursive: true, force: true }); }
});
