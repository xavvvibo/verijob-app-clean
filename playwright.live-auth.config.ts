import { defineConfig, devices } from '@playwright/test';

const headed = process.env.PLAYWRIGHT_HEADED !== '0';

export default defineConfig({
  testDir: './tests/auth',
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'https://app.verijob.es',
    headless: !headed,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
