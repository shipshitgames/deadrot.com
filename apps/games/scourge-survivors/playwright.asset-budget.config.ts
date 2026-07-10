import { defineConfig, devices } from "@playwright/test";

// Keep the production resource gate isolated from the normal DEV E2E server.
// Override this in parallel worktrees so strictPort catches cross-checkout mixups.
const port = Number(process.env.E2E_ASSET_BUDGET_PORT ?? 5278);

export default defineConfig({
  testDir: "./tests/browser-budget",
  outputDir: process.env.PLAYWRIGHT_ASSET_BUDGET_OUTPUT_DIR ?? "test-results/browser-budget",
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["list"],
        [
          "html",
          {
            open: "never",
            outputFolder: process.env.PLAYWRIGHT_ASSET_BUDGET_HTML_REPORT ?? "playwright-report-browser-budget",
          },
        ],
      ]
    : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `bunx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-production-asset-budget",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
