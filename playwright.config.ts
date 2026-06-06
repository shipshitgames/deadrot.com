import { defineConfig, devices } from '@playwright/test'

const CI = Boolean(process.env.CI)

const games = [
  { name: 'deadlane', port: 5174 },
  { name: 'pactfall', port: 5175 },
  { name: 'redline', port: 5176 },
  { name: 'rothulk', port: 5177 },
  { name: 'scourge-survivors', port: 5178 },
  { name: 'starblight', port: 5179 },
  { name: 'warline', port: 5180 },
] as const

const viewports = [
  { name: 'desktop', device: devices['Desktop Chrome'] },
  { name: 'mobile', device: devices['Pixel 7'] },
] as const

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  outputDir: 'test-results/e2e',
  reporter: CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: games.map((game) => ({
    command: `bun run --cwd apps/games/${game.name} dev --host 127.0.0.1 --port ${game.port}`,
    url: `http://127.0.0.1:${game.port}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  })),
  projects: games.flatMap((game) =>
    viewports.map((viewport) => ({
      name: `${game.name}:${viewport.name}`,
      testMatch: /games\.spec\.ts/,
      use: {
        ...viewport.device,
        baseURL: `http://127.0.0.1:${game.port}`,
      },
    })),
  ),
})
