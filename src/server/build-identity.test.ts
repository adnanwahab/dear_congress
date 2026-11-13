import { expect, test } from "bun:test";
import { sanitizeBuild } from "./build-identity";
import { renderPage } from "./pages";

test("build diagnostics allowlist fields and reject malformed identity", () => {
  expect(sanitizeBuild({ commit: '<script>secret</script>', builtAt: 'secret', ADMIN_TOKEN: 'secret' })).toEqual({
    commit: null, builtAt: null, repository: 'https://github.com/adnanwahab/dear_congress', mode: 'demo',
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
