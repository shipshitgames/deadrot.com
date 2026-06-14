import { defineConfig, devices } from "@playwright/test";

// Overridable so parallel checkouts/worktrees on one machine don't fight over
// a single port (reuseExistingServer would silently test the wrong bundle).
const port = Number(process.env.E2E_PORT ?? 5178);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: process.env.PLAYWRIGHT_TEST_OUTPUT_DIR ?? "test-results",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: process.env.PLAYWRIGHT_HTML_REPORT ?? "playwright-report" }]]
    : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `bun run dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/?sandbox=1`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
