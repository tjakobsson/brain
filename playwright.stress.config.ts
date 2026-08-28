import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/stress",
  testMatch: "**/*.pw.ts",
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4332/stress/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-stress-browser-fixture.mjs",
    url: "http://127.0.0.1:4332/stress/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
