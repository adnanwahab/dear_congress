import { defineConfig } from '@playwright/test';
// Separate opt-in suite: never included in the short motion gate.
export default defineConfig({
  testDir: '.', testMatch: 'memory.soak.ts', workers: 1, retries: 0,
  timeout: 35 * 60_000,
  outputDir: '../../artifacts/memory/test-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3107', browserName: 'chromium', viewport: { width: 1280, height: 800 } },
  webServer: { command: 'bun --no-env-file scripts/accessibility-server.ts', cwd: new URL('../../', import.meta.url).pathname, url: 'http://127.0.0.1:3107/healthz', reuseExistingServer: false, timeout: 120000 },
});
