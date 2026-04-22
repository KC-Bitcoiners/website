import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for bodarc.
 *
 * Modes:
 *   pnpm test              — run all tests (local mode, fresh nsec)
 *   pnpm test:ci           — run only tests that don't need relay/whitelist
 *   pnpm test:login        — run login tests only
 *   pnpm test:calendar     — run calendar tests only
 *   pnpm test:committees   — run committees tests only
 *   pnpm test:education    — run education tests only
 *
 * Tags:
 *   @login @calendar @committees @education  — page tags
 *   @whitelist  — requires a whitelisted nsec (relay CRUD)
 *
 * In CI mode, @whitelist tests are excluded.
 */

const isCI = !!process.env.CI;
const hasExistingServer = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  testIgnore: /.*\.test\.ts$/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // In CI, skip @whitelist tests (they need relay access with fresh nsec)
  grepInvert: isCI ? [/@whitelist/] : [],
  webServer: {
    command: "NEXT_DIST_DIR=/tmp/bodarc-next pnpm dev",
    port: 3000,
    reuseExistingServer: !isCI || hasExistingServer,
    timeout: 120_000,
  },
});
