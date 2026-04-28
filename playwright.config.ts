import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5175',
    screenshot: 'on',
    video: 'retain-on-failure',
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  outputDir: 'e2e/screenshots',
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
