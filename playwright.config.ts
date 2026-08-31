import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-browser-fixture.mjs",
    url: "http://127.0.0.1:4329/vault-repo/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-root",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4328/" },
    },
    {
      name: "chromium-subpath",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4329/vault-repo/" },
    },
    {
      name: "chromium-custom-domain",
      use: { ...devices["Desktop Chrome"], baseURL: "http://notes.localhost:4330/" },
    },
    {
      name: "webkit-code-blocks-phone",
      testMatch: "**/code-blocks.pw.ts",
      use: { ...devices["iPhone 13"], baseURL: "http://127.0.0.1:4328/" },
    },
  ],
});
