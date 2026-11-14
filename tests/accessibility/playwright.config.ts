import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pw.ts',
  workers: 2,
  outputDir: '../../artifacts/accessibility/test-results',
  reporter: [['list'], ['json', { outputFile: '../../artifacts/accessibility/results.json' }], ['html', { outputFolder: '../../artifacts/accessibility/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3107', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'bun --no-env-file scripts/accessibility-server.ts', cwd: new URL('../../', import.meta.url).pathname, url: 'http://127.0.0.1:3107/healthz', reuseExistingServer: false, timeout: 120000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } },
    { name: 'reduced-motion', use: { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' } },
    { name: 'high-contrast', use: { viewport: { width: 1440, height: 1000 }, forcedColors: 'active' } },
    // Half the CSS viewport models the reflow at 200% desktop browser zoom.
    // Actual browser zoom, magnification and AT remain on the manual checklist.
    { name: 'zoom-200-reflow', use: { viewport: { width: 720, height: 500 } } },
  ],
});
