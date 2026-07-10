import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Web (hub) E2E — kept SEPARATE from the root playwright.config.ts, which boots the
// per-game Vite dev servers. This one boots `next dev` for apps/web only and drives
// the marketing/access surface (waitlist + game-card access states, #355). Desktop +
// mobile projects satisfy AC5 ("mobile + desktop smoke tests cover the waitlist path").
//
// No Clerk/Stripe env is set, so the gate degrades fully open (lib/access.ts
// authEnabled === false) and every card renders its static access badge — the smoke
// path never depends on auth being configured. Waitlist success still requires a
// durable write: E2E explicitly uses an fsynced JSONL file under the OS temp dir.

const CI = Boolean(process.env.CI);
const PORT = Number(process.env.WEB_E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  outputDir: "test-results/e2e",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `bun run --cwd . next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !CI,
    timeout: 120_000,
    // Feature-flag kill-switch (#384) so flags.spec.ts can exercise game
    // visibility end-to-end: Rothulk is flipped OFF by default while every other
    // game stays default-ON. PostHog stays unconfigured, so this deterministic
    // FLAG_OVERRIDES is the only flag input — no network, fully reproducible.
    env: {
      ...process.env,
      FLAG_OVERRIDES: process.env.FLAG_OVERRIDES ?? JSON.stringify({ "game-rothulk-visible": false }),
      WAITLIST_LOCAL_FILE: process.env.WAITLIST_LOCAL_FILE ?? join(tmpdir(), `deadrot-waitlist-e2e-${PORT}.jsonl`),
    },
  },
  projects: [
    { name: "web:desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "web:mobile", use: { ...devices["Pixel 7"] } },
  ],
});
