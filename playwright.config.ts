// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60000,
  retries: 0,
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1, // Use a single worker to avoid issues with MetaMask extension
  reporter: [
    ['html', { open: 'never' }],],
 
  use: {
    headless: false, // Extension doesn't work in headless mode
    channel: 'chrome', // Use Chrome for better extension support
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
  },
});
