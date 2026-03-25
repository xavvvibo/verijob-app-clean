import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/demo",
  timeout: 30 * 60 * 1000,
  fullyParallel: false,
  reporter: "html",
  use: {
    baseURL: "https://app.verijob.es",
    trace: "on-first-retry",
    video: "on",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
