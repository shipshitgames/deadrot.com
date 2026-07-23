import { expect, type Page, test } from "@playwright/test";

interface DebugCard {
  id: string;
  level: number;
}

interface DebugChip {
  id: string;
  level: number;
}

interface StarblightSnapshot {
  phase: "title" | "playing" | "paused" | "levelup" | "gameover" | "victory";
  timeSec: number;
  level: number;
  integrity: number;
  maxIntegrity: number;
  kills: number;
  salvage: number;
  aliveEnemies: number;
  bossHp01: number | null;
  ship: { x: number; y: number };
  draft: DebugCard[] | null;
  build: DebugChip[];
}

interface StarblightWindow {
  __starblight: {
    snapshot(): StarblightSnapshot;
    startRun(): void;
    advance(seconds: number): void;
    spawnTarget(): void;
    forceLevelUp(): void;
    pickDraftCard(id: string): void;
    forceBoss(): void;
    setBossHp01(hp01: number): void;
  };
}

test.describe("starblight headless harness", () => {
  test("boots, flies, fights, and collects salvage through production systems", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "Starblight-only headless regression.");
    const errors = captureErrors(page);
    await boot(page);

    expect((await snapshot(page)).phase).toBe("title");
    await invoke(page, "startRun");
    const started = await snapshot(page);
    expect(started.phase).toBe("playing");
    expect(started.integrity).toBe(started.maxIntegrity);

    await page.keyboard.down("KeyD");
    await advance(page, 0.5);
    await page.keyboard.up("KeyD");
    const flown = await snapshot(page);
    expect(flown.timeSec).toBeGreaterThan(started.timeSec);
    expect(flown.ship.x).toBeGreaterThan(started.ship.x);

    const spawned = await page.evaluate(() => {
      const hook = (window as unknown as StarblightWindow).__starblight;
      hook.spawnTarget();
      return hook.snapshot();
    });
    expect(spawned.aliveEnemies).toBeGreaterThan(flown.aliveEnemies);
    const cleared = await advanceUntil(page, (state) => state.kills > 0 && state.salvage > 0);
    expect(cleared.phase).toBe("playing");
    expect(Number.isInteger(cleared.aliveEnemies)).toBe(true);
    await expect(page.locator("#kills")).not.toHaveText("0 kills");
    await expect(page.locator("#salvage")).not.toHaveText("0");
    expectNoErrors(errors);
  });

  test("forces a three-card draft and applies the first card by id", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "Starblight-only headless regression.");
    const errors = captureErrors(page);
    await boot(page);
    await invoke(page, "startRun");
    await invoke(page, "forceLevelUp");

    const drafting = await snapshot(page);
    expect(drafting.phase).toBe("levelup");
    expect(drafting.level).toBe(2);
    expect(drafting.draft).toHaveLength(3);
    await expect(page.locator("#draft")).not.toHaveClass(/hidden/);
    await expect(page.locator("#draft-cards .ssg-upgrade-card")).toHaveCount(3);

    const first = drafting.draft?.[0];
    expect(first).toBeDefined();
    await page.evaluate((id) => (window as unknown as StarblightWindow).__starblight.pickDraftCard(id), first!.id);

    const picked = await snapshot(page);
    expect(picked.phase).toBe("playing");
    expect(picked.build.find((chip) => chip.id === first!.id)?.level).toBe(first!.level + 1);
    await expect(page.locator("#draft")).toHaveClass(/hidden/);
    expectNoErrors(errors);
  });

  test("forces the boss and keeps the HUD bar synchronized with boss health", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "Starblight-only headless regression.");
    const errors = captureErrors(page);
    await boot(page);
    await invoke(page, "startRun");
    await invoke(page, "forceBoss");

    expect((await snapshot(page)).bossHp01).toBe(1);
    await expect(page.locator("#boss-bar")).not.toHaveClass(/hidden/);
    await expect(page.locator("#boss-fill")).toHaveAttribute("style", /width:\s*100%/);

    await page.evaluate(() => (window as unknown as StarblightWindow).__starblight.setBossHp01(0.5));
    expect((await snapshot(page)).bossHp01).toBe(0.5);
    await expect(page.locator("#boss-fill")).toHaveAttribute("style", /width:\s*50%/);
    expectNoErrors(errors);
  });
});

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator("#scene")).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<StarblightWindow>).__starblight));
}

async function snapshot(page: Page): Promise<StarblightSnapshot> {
  return page.evaluate(() => (window as unknown as StarblightWindow).__starblight.snapshot());
}

async function invoke(page: Page, method: "startRun" | "spawnTarget" | "forceLevelUp" | "forceBoss") {
  await page.evaluate((name) => (window as unknown as StarblightWindow).__starblight[name](), method);
}

async function advance(page: Page, seconds: number) {
  await page.evaluate((duration) => (window as unknown as StarblightWindow).__starblight.advance(duration), seconds);
}

async function advanceUntil(
  page: Page,
  predicate: (state: StarblightSnapshot) => boolean,
  { chunk = 0.25, maxSeconds = 12 }: { chunk?: number; maxSeconds?: number } = {},
) {
  let elapsed = 0;
  let state = await snapshot(page);
  while (!predicate(state) && elapsed < maxSeconds) {
    await advance(page, chunk);
    elapsed += chunk;
    state = await snapshot(page);
  }
  if (!predicate(state)) {
    throw new Error(`Starblight state did not converge after ${maxSeconds}s: ${JSON.stringify(state)}`);
  }
  return state;
}

function captureErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return { consoleErrors, pageErrors };
}

function expectNoErrors(errors: { consoleErrors: string[]; pageErrors: string[] }) {
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
}
