import { GAME_APPS } from "@deadrot/catalog";
import { defineConfig, devices } from "@playwright/test";
import { parsePortBase, parseSelectedGameSlugs, parseSelectedViewports } from "./e2e/game-catalog";

const CI = Boolean(process.env.CI);
const outputDir = process.env.PLAYWRIGHT_TEST_OUTPUT_DIR ?? "test-results/e2e";
const htmlReportDir = process.env.PLAYWRIGHT_HTML_REPORT ?? "playwright-report";
const selectedGameSlugs = parseSelectedGameSlugs(process.env.E2E_GAME_SLUGS);
const portOffset = parsePortBase(process.env.E2E_PORT_BASE) - 5174;
const reuseExistingServer = process.env.E2E_REUSE_SERVERS === "1";
const games = (
  selectedGameSlugs.length ? GAME_APPS.filter((game) => selectedGameSlugs.includes(game.slug)) : GAME_APPS
).map((game) => ({
  slug: game.slug,
  port: game.devPort + portOffset,
}));

const viewports = [
  { name: "desktop", device: devices["Desktop Chrome"] },
  { name: "mobile", device: devices["Pixel 7"] },
] as const;

// Optional viewport filter (mirrors E2E_GAME_SLUGS). Empty/unset = all viewports,
// so local runs and the Docker image are unchanged; CI sets one per matrix shard.
const selectedViewports = parseSelectedViewports(process.env.E2E_VIEWPORT);
const activeViewports = selectedViewports.length
  ? viewports.filter((viewport) => selectedViewports.includes(viewport.name))
  : viewports;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  outputDir,
  reporter: [["list"], ["html", { open: "never", outputFolder: htmlReportDir }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: games.map((game) => ({
    command: `bun run --cwd apps/games/${game.slug} dev --host 127.0.0.1 --port ${game.port}`,
    url: `http://127.0.0.1:${game.port}`,
    reuseExistingServer,
    timeout: 120_000,
  })),
  projects: games.flatMap((game) =>
    activeViewports.map((viewport) => ({
      name: `${game.slug}:${viewport.name}`,
      testMatch: [/games\.spec\.ts/, /rothulk-platforming\.spec\.ts/, /warline-reporting\.spec\.ts/],
      use: {
        ...viewport.device,
        baseURL: `http://127.0.0.1:${game.port}`,
      },
    })),
  ),
});
