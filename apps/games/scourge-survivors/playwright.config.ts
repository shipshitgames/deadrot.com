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
  // One worker: every spec drives heavy WebGL/Three.js gameplay against a single
  // shared dev server on one port, so parallel workers thrash that server and
  // flake on frame timing. Mirrors the root e2e config's workers:1 for the same
  // reason. (On a 2-core CI runner Playwright already defaults to ~1 worker; this
  // makes it explicit and keeps local high-core-count runs reliable too.)
  workers: 1,
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
  // Two projects, disjoint by file, not a matrix. Every spec but one drives the
  // keyboard and pointer lock, which a phone profile has neither of; the touch
  // spec drives the on-screen pad, which only renders for a coarse pointer. So
  // each file runs exactly once, on the device that can actually play it —
  // running the full suite twice would double a job that already takes minutes
  // and fail half of what it doubled.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /touch-controls\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /touch-controls\.spec\.ts/,
    },
  ],
});
