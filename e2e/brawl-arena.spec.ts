import { expect, type Page, test } from "@playwright/test";

interface ArenaFighterDebug {
  slot: number;
  id: string;
  x: number;
  y: number;
  stocks: number;
  damage: number;
  respawn: number;
  eliminated: boolean;
  isPlayer: boolean;
}

interface ArenaHudFighter {
  slot: number;
  name: string;
  stocks: number;
  damage: number;
  eliminated: boolean;
  isPlayer: boolean;
}

interface BrawlSnapshot {
  status: "select" | "playing" | "round-over";
  mode: "duel" | "arena";
  timer: number;
  arena: { slots: number; alive: number; winnerName: string | null; fighters: ArenaHudFighter[] } | null;
  arenaFighters: ArenaFighterDebug[];
  result: { outcome: "victory" | "defeat"; reason: "ko" | "time" | "last-standing"; winnerName: string } | null;
}

interface BrawlWindow {
  __brawlGame: {
    startArena: (id?: string, slots?: number) => void;
    debugRingOut: (slot: number) => void;
    debugEliminateRivals: () => void;
    debugSetTimer: (seconds: number) => void;
    rematch: () => void;
  };
  __brawlSnapshot: () => BrawlSnapshot;
}

// Arena supports 2, 3 and 4 fighters — drive each count through the real UI so a
// regression in the slot picker or roster builder is caught (acceptance #1).
for (const slots of [2, 3, 4] as const) {
  test(`Arena mode starts a ${slots}-fighter free-for-all from the UI`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

    await boot(page);
    await page.getByRole("button", { name: "Arena", exact: true }).click();
    await page.getByRole("button", { name: String(slots), exact: true }).click();
    await page.getByRole("button", { name: "Start Arena" }).click();

    await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");
    const state = await snapshot(page);
    expect(state.mode).toBe("arena");
    expect(state.arena?.slots).toBe(slots);
    expect(state.arenaFighters).toHaveLength(slots);
    expect(state.arena?.alive).toBe(slots);
    // Every fighter starts with the full stock count and zero damage.
    for (const fighter of state.arenaFighters) {
      expect(fighter.stocks).toBe(3);
      expect(fighter.damage).toBe(0);
      expect(fighter.eliminated).toBe(false);
    }
    expect(state.arenaFighters.filter((f) => f.isPlayer)).toHaveLength(1);
    // Distinct fighters across the line-up (no accidental duplicate slots).
    expect(new Set(state.arenaFighters.map((f) => f.id)).size).toBe(slots);
  });
}

test("each ring-out costs a stock until the last drains and the fighter is out", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

  await boot(page);
  await startArena(page, "pyre-duelist", 2);
  await expect.poll(() => snapshot(page).then((s) => s.arenaFighters.length)).toBe(2);
  expect((await snapshot(page)).arenaFighters[1]?.stocks).toBe(3);

  // First ring-out: 3 -> 2, then respawn with a fresh life (damage cleared,
  // intangible for a beat, dropped back near the respawn point).
  await ringOut(page, 1);
  await expect.poll(() => snapshot(page).then((s) => s.arenaFighters[1]?.stocks)).toBe(2);
  const respawned = (await snapshot(page)).arenaFighters[1];
  expect(respawned?.eliminated).toBe(false);
  expect(respawned?.damage).toBe(0);
  expect(respawned?.respawn).toBeGreaterThan(0);
  expect(Math.abs(respawned?.x ?? 99)).toBeLessThan(8); // back on stage, not shoved past the blast zone

  // Drain the remaining stocks: 2 -> 1 -> 0 -> eliminated.
  await ringOut(page, 1);
  await expect.poll(() => snapshot(page).then((s) => s.arenaFighters[1]?.stocks)).toBe(1);
  await ringOut(page, 1);

  // With the only rival gone the player is crowned last standing.
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("round-over");
  const state = await snapshot(page);
  expect(state.arenaFighters[1]?.stocks).toBe(0);
  expect(state.arenaFighters[1]?.eliminated).toBe(true);
  expect(state.result?.outcome).toBe("victory");
  expect(state.result?.reason).toBe("last-standing");
});

test("clearing the field ends the match with a last-standing victory and standings", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

  await boot(page);
  await startArena(page, "pyre-duelist", 3);
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");

  await page.evaluate(() => (window as unknown as BrawlWindow).__brawlGame.debugEliminateRivals());

  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("round-over");
  const state = await snapshot(page);
  expect(state.mode).toBe("arena");
  expect(state.result?.outcome).toBe("victory");
  expect(state.result?.reason).toBe("last-standing");
  expect(state.arenaFighters[0]?.eliminated).toBe(false);
  expect(state.arena?.alive).toBe(1);
  // The scoreboard reflects the wipe: the player survives, every rival is out.
  const standings = state.arena?.fighters ?? [];
  expect(standings.length).toBe(3);
  expect(standings.every((f) => f.name.length > 0)).toBe(true);
  expect(standings.filter((f) => f.eliminated)).toHaveLength(2);
  expect(state.arena?.winnerName).toBe(standings.find((f) => f.isPlayer)?.name);
});

test("the round ends on the clock with a time finish when fighters remain", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

  await boot(page);
  await startArena(page, "pyre-duelist", 3);
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");

  // Jump the clock to the final tick; the next frame should crown a survivor.
  await page.evaluate(() => (window as unknown as BrawlWindow).__brawlGame.debugSetTimer(0.05));

  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("round-over");
  const state = await snapshot(page);
  expect(state.result?.reason).toBe("time");
  expect(state.result?.winnerName.length).toBeGreaterThan(0);
  expect(state.arena?.winnerName).toBe(state.result?.winnerName);
});

test("a finished arena can be replayed via rematch with state reset", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

  await boot(page);
  await startArena(page, "pyre-duelist", 3);
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");
  await page.evaluate(() => (window as unknown as BrawlWindow).__brawlGame.debugEliminateRivals());
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("round-over");

  await page.evaluate(() => (window as unknown as BrawlWindow).__brawlGame.rematch());

  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");
  const state = await snapshot(page);
  expect(state.mode).toBe("arena");
  expect(state.result).toBeNull();
  expect(state.arena?.alive).toBe(3);
  for (const fighter of state.arenaFighters) {
    expect(fighter.stocks).toBe(3);
    expect(fighter.damage).toBe(0);
    expect(fighter.eliminated).toBe(false);
  }
});

test("the bots fight on their own — damage accrues without player input", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

  await boot(page);
  await startArena(page, "pyre-duelist", 3);
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");

  // No virtual input is sent; the AI fighters should seek each other out and
  // land hits, so accumulated damage appears somewhere on the field.
  await expect
    .poll(() => snapshot(page).then((s) => s.arenaFighters.some((f) => f.damage > 0 || f.stocks < 3)), {
      timeout: 15_000,
    })
    .toBe(true);
});

test("Duel mode remains playable alongside Arena", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("brawl:"), "Brawl-only Arena regression.");

  await boot(page);
  await page.getByRole("button", { name: "Fight" }).click();
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");
  const state = await snapshot(page);
  expect(state.mode).toBe("duel");
  expect(state.arena).toBeNull();
});

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Brawl" })).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __brawlGame?: unknown }).__brawlGame));
}

async function startArena(page: Page, id: string, slots: number) {
  await page.evaluate(
    ({ fighterId, count }) => (window as unknown as BrawlWindow).__brawlGame.startArena(fighterId, count),
    { fighterId: id, count: slots },
  );
}

async function ringOut(page: Page, slot: number) {
  await page.evaluate((s) => (window as unknown as BrawlWindow).__brawlGame.debugRingOut(s), slot);
}

async function snapshot(page: Page): Promise<BrawlSnapshot> {
  return page.evaluate(() => (window as unknown as BrawlWindow).__brawlSnapshot());
}
