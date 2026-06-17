import { expect, type Page, test } from "@playwright/test";

// Scourge Survivors "Scourge Labs" sandbox deep slice: the dev-only sandbox is a
// no-progression labs sim — foes spawn into a pooled arena, the full arsenal is
// unlocked, and every drive is a deterministic window-hook poke. We drive the
// live Game via the DEV hooks App.tsx installs (__fpsGame / __hudSnapshot) and
// read state straight back from the React HUD ref, so no pointerlock, no
// real-time gameplay, and no arbitrary waits are needed. Extends (does not
// duplicate) the boot smoke in games.spec.ts. Mirrors the pactfall-moba slice:
// typed snapshot interface + boot()/snapshot()/field() helpers + deterministic
// entity-poke drives, here through the PUBLIC sandbox API rather than private
// entity arrays (the supported drive surface — Game.ts:179-355).

interface ScourgeHud {
  sandbox: boolean;
  status: "pointerlock-needed" | "playing" | "paused" | "levelup" | "gameover";
  runMode: "sandbox" | "structured" | "coop" | "campaign";
  enemiesAlive: number;
  kills: number;
  headshots: number;
  bossActive: boolean;
  bossHealthFrac: number;
  weapon: string;
  toastSeq: number;
}

test("sandbox boots into a labs sim with no run progression", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only sandbox deep slice.");

  await boot(page);

  // Beyond the boot smoke: the snapshot reports the SANDBOX run mode (not a
  // campaign/survivors run) and a clean, empty field — no waves have spun up.
  const snap = await snapshot(page);
  expect(snap.sandbox).toBe(true);
  expect(snap.status).toBe("pointerlock-needed");
  expect(snap.runMode).toBe("sandbox");
  expect(snap.enemiesAlive).toBe(0);
  expect(snap.bossActive).toBe(false);

  // The labs panel renders and its live "Foes" tile reads zero on a fresh arena.
  await expect(page.getByText("Scourge Labs")).toBeVisible();
  expect(await field(page, "enemiesAlive")).toBe(0);
});

test("spawning foes raises the live count and clearing the lab empties it", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only sandbox deep slice.");

  await boot(page);

  // Spawns are additive against the pooled enemy list (no wave director auto-reset
  // in sandbox), so a count of 5 then 3 totals 8 alive (both within the 1..12 clamp).
  await spawnEnemies(page, "melee", 5);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(5);
  await spawnEnemies(page, "ranged", 3);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(8);

  // Clearing the lab kills every pooled enemy and drops the count back to zero —
  // the deterministic reset between assertions.
  await clearLab(page);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(0);
  await expect.poll(() => field(page, "bossActive")).toBe(false);
});

test("felling foes credits kills + headshots through the sim", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only sandbox deep slice.");

  await boot(page);

  // A fresh sandbox has no run progression banked yet.
  expect(await field(page, "kills")).toBe(0);
  expect(await field(page, "headshots")).toBe(0);

  await spawnEnemies(page, "melee", 4);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(4);

  // Instakill every alive enemy as headshots (amount < 0 ⇒ dmg = health+1 lethal;
  // all=true hits the whole field). Each death routes through onEnemyDeath, which
  // bumps kills, and the headshot path bumps headshots — so both credit by 4.
  await killAllAsHeadshots(page);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(0);
  await expect.poll(() => field(page, "kills")).toBe(4);
  await expect.poll(() => field(page, "headshots")).toBe(4);

  // Leave the lab empty for the next spec (shared dev server across projects).
  await clearLab(page);
});

test("a spawned boss occupies the field and falls to lab damage", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only sandbox deep slice.");

  await boot(page);

  // A boss is always a single actor; it flags bossActive and carries a live
  // health bar (frac > 0 while it stands).
  await spawnBoss(page);
  await expect.poll(() => field(page, "bossActive")).toBe(true);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(1);
  await expect.poll(() => field(page, "bossHealthFrac")).toBeGreaterThan(0);

  // Topple it through the lab-damage path: the boss death clears bossActive and
  // empties the field (and bumps bossKills via onEnemyDeath).
  await killAllAsHeadshots(page);
  await expect.poll(() => field(page, "enemiesAlive")).toBe(0);
  await expect.poll(() => field(page, "bossActive")).toBe(false);
});

test("the runtime asset browser lists sprites then textures", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only sandbox deep slice.");

  await boot(page);

  // The Runtime Assets section is collapsed by default (defaultOpen={false}); its
  // figcaptions live in a hidden div until the toggle is clicked.
  await page.getByRole("button", { name: /runtime assets/i }).click();

  // Default filter is "sprite": the gun + boss sprite captions render (matches the
  // smoke), then we go deeper by switching the filter.
  await expect(page.locator("figcaption").filter({ hasText: /^Pistol$/ })).toBeVisible();
  await expect(page.locator("figcaption").filter({ hasText: /^Boss front$/ })).toBeVisible();

  // Switching to the texture filter swaps the grid: arena textures appear and the
  // sprite-only captions are gone (proving the filter actually re-renders the list).
  await page.getByRole("button", { name: "texture" }).click();
  await expect(page.locator("figcaption").filter({ hasText: /^Arena floor$/ })).toBeVisible();
  await expect(page.locator("figcaption").filter({ hasText: /^Pistol$/ })).toHaveCount(0);
});

test("swapping weapons in the panel updates the live HUD weapon", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only sandbox deep slice.");

  await boot(page);

  // Clicking the SMG weapon button drives setSandboxWeapon, which updates the HUD
  // `weapon` to the DISPLAY name (not the id) and bumps the deterministic toastSeq.
  // This asserts UI ↔ hook parity (the panel button and the snapshot agree).
  const beforeSeq = await field(page, "toastSeq");
  await page.getByRole("button", { name: "SMG" }).click();
  await expect.poll(() => field(page, "weapon")).toBe("SMG");
  await expect.poll(() => field(page, "toastSeq")).toBeGreaterThan(beforeSeq);
});

// ---- helpers ----------------------------------------------------------------

async function boot(page: Page) {
  // Collect console errors / page errors and fail on anything unexpected. The
  // sandbox never connects multiplayer and telemetry is offline-safe, so the
  // console should stay clean — gameSpecs["scourge-survivors"] sets no
  // ignoredConsoleErrors, so we honour that and tolerate none.
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  // `?sandbox=1` is mandatory: initialSandbox only flips on under DEV + sandbox=1,
  // and without it the SandboxPanel never mounts. The e2e webServer runs the Vite
  // dev server (DEV), so the sandbox + the __fpsGame/__hudSnapshot hooks install.
  await page.goto("/?sandbox=1");
  await expect(page.getByText("Scourge Labs")).toBeVisible();
  await expect(page.getByTestId("game-canvas")).toBeVisible();

  // Wait for the DEV hooks to be installed before driving the game.
  await page.waitForFunction(() => {
    const win = window as unknown as { __fpsGame?: unknown; __hudSnapshot?: () => unknown };
    return Boolean(win.__fpsGame && win.__hudSnapshot);
  });

  // Sanity-gate the starting snapshot (matches the smoke) before deep drives.
  expect(await snapshot(page)).toMatchObject({ sandbox: true, status: "pointerlock-needed" });

  // The boot path must not have logged any errors.
  expect(consoleErrors).toEqual([]);
}

async function snapshot(page: Page): Promise<ScourgeHud> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => ScourgeHud }).__hudSnapshot());
}

async function field<K extends keyof ScourgeHud>(page: Page, key: K): Promise<ScourgeHud[K]> {
  return page.evaluate((k) => (window as unknown as { __hudSnapshot: () => ScourgeHud }).__hudSnapshot()[k], key);
}

async function spawnEnemies(page: Page, kind: string, count: number) {
  await page.evaluate(
    ({ kind, count }) =>
      (
        window as unknown as { __fpsGame: { spawnSandboxEnemy: (k: string, c?: number) => void } }
      ).__fpsGame.spawnSandboxEnemy(kind, count),
    { kind, count },
  );
}

async function spawnBoss(page: Page) {
  await page.evaluate(() =>
    (
      window as unknown as { __fpsGame: { spawnSandboxEnemy: (k: string, c?: number) => void } }
    ).__fpsGame.spawnSandboxEnemy("boss", 1),
  );
}

async function killAllAsHeadshots(page: Page) {
  // amount < 0 ⇒ instakill (dmg = health+1); headshot + all hit every alive enemy.
  await page.evaluate(() =>
    (
      window as unknown as { __fpsGame: { damageSandboxEnemies: (a: number, h?: boolean, all?: boolean) => void } }
    ).__fpsGame.damageSandboxEnemies(-1, true, true),
  );
}

async function clearLab(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { __fpsGame: { clearSandboxActors: () => void } }).__fpsGame.clearSandboxActors(),
  );
}
