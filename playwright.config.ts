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
      // The realistic-scale fixture has its own project; these serve the demo
      // vault, where a 400-node assertion cannot hold.
      testIgnore: "**/graph-scale.pw.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4328/" },
    },
    {
      name: "chromium-subpath",
      // The realistic-scale fixture has its own project; these serve the demo
      // vault, where a 400-node assertion cannot hold.
      testIgnore: "**/graph-scale.pw.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4329/vault-repo/" },
    },
    {
      name: "chromium-custom-domain",
      // The realistic-scale fixture has its own project; these serve the demo
      // vault, where a 400-node assertion cannot hold.
      testIgnore: "**/graph-scale.pw.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://notes.localhost:4330/" },
    },
    {
      name: "webkit-code-blocks-phone",
      testMatch: "**/code-blocks.pw.ts",
      use: { ...devices["iPhone 13"], baseURL: "http://127.0.0.1:4328/" },
    },
    {
      // The conditions the change's baseline screenshots were taken under, so
      // label and density assertions measure what the screenshots show.
      name: "chromium-realistic-phone",
      testMatch: "**/graph-scale.pw.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        baseURL: "http://127.0.0.1:4334/realistic/",
      },
    },
  ],
});
