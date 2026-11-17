import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '**/*.pw.ts', fullyParallel: true,
  snapshotPathTemplate: '{testDir}/baselines/{platform}/{projectName}/{testFilePath}/{testName}/{arg}{ext}',
  forbidOnly: !!process.env.CI, retries: 0, workers: 2,
  outputDir: '../../artifacts/visual/test-results',
  reporter: [['list'], ['html', { outputFolder: '../../artifacts/visual/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3107', locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light', trace: 'retain-on-failure' },
  webServer: { command: 'bun --no-env-file scripts/accessibility-server.ts', cwd: new URL('../../', import.meta.url).pathname, url: 'http://127.0.0.1:3107/healthz', reuseExistingServer: false, timeout: 120000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'desktop-reduced', use: { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' } },
    { name: 'mobile-reduced', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' } },
  ],
});
