import { expect, type Page, test } from "@playwright/test";

// Headshot-kill feedback beat (#417): a lethal headshot layers the shared
// skull-pop FX beat (FxSystem.spawnHeadshotKillFx) on the normal death
// animation, via the single hook in PveDirectorSystem.onEnemyDeath. The
// observable seam is sys.fx.headshotKillSeq (monotonic) + lastHeadshotKill.

type LastHeadshotKill = { x: number; z: number; scale: number; boss: boolean; at: number } | null;

type DevGame = {
  clearSandboxActors: () => void;
  damageSandboxEnemies: (amount: number, headshot?: boolean, all?: boolean) => void;
  spawnSandboxEnemy: (kind: "melee" | "boss", count?: number) => void;
  startSandbox: () => Promise<void>;
  ctx: {
    body: { position: { x: number; z: number } };
    enemies: Array<{ alive: boolean; group: { position: { x: number; z: number } } }>;
    status: string;
    hitstopTimer: number;
    kills: number;
    headshots: number;
  };
  sys: {
    fx: {
      headshotKillSeq: number;
      lastHeadshotKill: LastHeadshotKill;
      pops: unknown[];
      deathSprites: Array<{ material: unknown }>;
    };
    pve: { bossActive: boolean };
    hud: { emit: () => void };
  };
};

function collectConsoleErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("PointerLockControls: Unable to use Pointer Lock API")) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  return consoleErrors;
}

async function bootSandbox(page: Page) {
  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
}

test.describe("headshot kill feedback", () => {
  test("plays the headshot kill beat only on lethal headshots", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootSandbox(page);

    const result = await page.evaluate(async () => {
      type EvalGame = {
        clearSandboxActors: () => void;
        damageSandboxEnemies: (amount: number, headshot?: boolean, all?: boolean) => void;
        spawnSandboxEnemy: (kind: "melee", count?: number) => void;
        startSandbox: () => Promise<void>;
        ctx: {
          body: { position: { x: number; z: number } };
          enemies: Array<{ alive: boolean; group: { position: { x: number; z: number } } }>;
          status: string;
          hitstopTimer: number;
          kills: number;
          headshots: number;
        };
        sys: {
          fx: {
            headshotKillSeq: number;
            lastHeadshotKill: { x: number; z: number; scale: number; boss: boolean; at: number } | null;
            pops: unknown[];
            deathSprites: unknown[];
          };
        };
      };
      const game = (window as unknown as { __fpsGame: EvalGame }).__fpsGame;
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const parkNearestInFront = () => {
        const enemy = game.ctx.enemies.find((candidate) => candidate.alive);
        if (enemy) {
          enemy.group.position.x = game.ctx.body.position.x;
          enemy.group.position.z = game.ctx.body.position.z - 8;
        }
      };

      await game.startSandbox();
      game.ctx.status = "playing";
      game.clearSandboxActors();
      const seq0 = game.sys.fx.headshotKillSeq;

      // Phase A — control: a lethal BODY kill must not fire the beat.
      game.spawnSandboxEnemy("melee", 1);
      parkNearestInFront();
      game.damageSandboxEnemies(-1, false);
      const seqBody = game.sys.fx.headshotKillSeq;
      await wait(80);

      // Phase B — a NON-lethal headshot must not fire the beat (lethal only).
      game.clearSandboxActors();
      game.spawnSandboxEnemy("melee", 1);
      parkNearestInFront();
      game.damageSandboxEnemies(1, true);
      const seqGraze = game.sys.fx.headshotKillSeq;

      // Phase C — the lethal headshot. The seam increments synchronously inside
      // the call, so sample it (and the transient hitstop) before any frame runs.
      const kills0 = game.ctx.kills;
      const hs0 = game.ctx.headshots;
      game.damageSandboxEnemies(-1, true);
      const seqHead = game.sys.fx.headshotKillSeq;
      const last = game.sys.fx.lastHeadshotKill;
      const stop = game.ctx.hitstopTimer;
      await wait(80);
      const alive = game.ctx.enemies.filter((candidate) => candidate.alive).length;

      // Phase D — cleanup: LAB CLEARED drains meshes but the seam is monotonic.
      game.clearSandboxActors();
      const seqAfterClear = game.sys.fx.headshotKillSeq;
      const popsAfterClear = game.sys.fx.pops.length;

      return {
        seq0,
        seqBody,
        seqGraze,
        seqHead,
        last,
        stop,
        alive,
        kills: game.ctx.kills - kills0,
        headshots: game.ctx.headshots - hs0,
        seqAfterClear,
        popsAfterClear,
      };
    });

    expect(result.seqBody).toBe(result.seq0); // body kill: no beat
    expect(result.seqGraze).toBe(result.seqBody); // non-lethal headshot: no beat
    expect(result.seqHead).toBe(result.seqGraze + 1); // exactly one beat on the lethal headshot
    expect(result.last).not.toBeNull();
    expect(result.last?.boss).toBe(false);
    expect(result.last?.scale).toBeGreaterThan(0);
    expect(result.stop).toBeGreaterThan(0); // the hitstop punch landed
    // Normal death flow intact: the enemy actually died and the existing
    // counters advanced. (Death-sprite rendering depends on async texture load
    // and is covered asset-timing-safely by sandbox.spec's death-frame test.)
    expect(result.alive).toBe(0); // hit registration + enemy cleanup not blocked
    expect(result.kills).toBe(1);
    expect(result.headshots).toBe(1); // existing counters preserved
    expect(result.seqAfterClear).toBe(result.seqHead); // seam survives clearTransientFx
    expect(result.popsAfterClear).toBe(0); // …while the meshes drain
    expect(consoleErrors).toEqual([]);
  });

  test("boss headshot kill plays the beat without breaking boss death flow", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootSandbox(page);

    const result = await page.evaluate(async () => {
      const game = (
        window as unknown as {
          __fpsGame: {
            clearSandboxActors: () => void;
            damageSandboxEnemies: (amount: number, headshot?: boolean, all?: boolean) => void;
            spawnSandboxEnemy: (kind: "boss", count?: number) => void;
            startSandbox: () => Promise<void>;
            ctx: { status: string };
            sys: {
              fx: {
                headshotKillSeq: number;
                lastHeadshotKill: { scale: number; boss: boolean } | null;
              };
            };
          };
        }
      ).__fpsGame;

      await game.startSandbox();
      game.ctx.status = "playing";
      game.clearSandboxActors();
      // Spawn and kill in the same synchronous block: no frame runs in between,
      // so the boss can never raise its shield before the shot lands.
      game.spawnSandboxEnemy("boss", 1);
      const seq0 = game.sys.fx.headshotKillSeq;
      game.damageSandboxEnemies(-1, true);
      return { seq0, seq1: game.sys.fx.headshotKillSeq, last: game.sys.fx.lastHeadshotKill };
    });

    expect(result.seq1).toBe(result.seq0 + 1);
    expect(result.last?.boss).toBe(true);
    expect(result.last?.scale).toBe(2.4);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.pve.bossActive))
      .toBe(false); // boss death flow unbroken
    expect(consoleErrors).toEqual([]);
  });

  test("sandbox panel Headshot Kill button drives the beat", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await bootSandbox(page);

    await page.evaluate(async () => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      await game.startSandbox();
      game.ctx.status = "playing";
      game.sys.hud.emit();
    });

    // Sections other than Session/Weapons default closed — expand it first.
    await page.getByRole("button", { name: /foes \+ reactions/i }).click();
    const section = page.locator("section").filter({ hasText: "Foes + Reactions" });
    await section.getByRole("button", { name: /spawn melee/i }).click();
    // Exact name: "Headshot Nearest" and "Headshot All" also live in the panel.
    await section.getByRole("button", { name: /^headshot kill$/i }).click();

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.fx.headshotKillSeq))
      .toBeGreaterThan(0);
    expect(consoleErrors).toEqual([]);
  });
});
