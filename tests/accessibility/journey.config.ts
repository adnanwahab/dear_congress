import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: '**/journey-history.pw.ts',
  projects: [
    { name: 'safari-routing', use: { browserName: 'webkit' } },
    { name: 'firefox-routing', use: { browserName: 'firefox' } },
    { name: 'safari-reduced-motion', use: { browserName: 'webkit', reducedMotion: 'reduce' } },
    { name: 'safari-touch', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
