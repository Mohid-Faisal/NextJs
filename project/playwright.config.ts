import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * Runs against a deployed environment (staging/preview) — NEVER against
 * production with real data. Set:
 *   PLAYWRIGHT_BASE_URL=https://your-staging.vercel.app
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD  (a dedicated staging test account)
 *
 * Locally: npm run build && npm start with a scratch database, then run npx playwright test.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
