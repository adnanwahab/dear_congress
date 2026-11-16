import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.pw.ts', workers: 1, retries: 0,
  outputDir: '../../artifacts/motion/test-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3107', browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true },
  webServer: { command: 'bun --no-env-file scripts/accessibility-server.ts', cwd: new URL('../../', import.meta.url).pathname, url: 'http://127.0.0.1:3107/healthz', reuseExistingServer: false, timeout: 120000 },
});
