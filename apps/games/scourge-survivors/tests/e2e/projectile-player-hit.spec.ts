// Issue #91 — ProjectileCombat seam gate: an enemy projectile must fly into the player and drop health.
import { expect, type Page, test } from "@playwright/test";

type HudSnapshot = {
  status: string;
  sandbox: boolean;
  playerHealth: number;
  maxPlayerHealth: number;
  damageSeq: number;
};

type Vec3 = {
  x: number;
  y: number;
  z: number;
  clone: () => Vec3;
  sub: (v: Vec3) => Vec3;
  normalize: () => Vec3;
  distanceTo: (v: Vec3) => number;
};

type DevGame = {
  startSandbox: () => void;
  clearSandboxActors: () => void;
  ctx: { status: string; body: { position: Vec3 } };
  sys: {
    hud: { emit: () => void };
    projectiles: {
      projectiles: unknown[];
      spawnProjectile: (shot: { origin: Vec3; dir: Vec3; damage: number; speed: number; fromBoss: boolean }) => void;
    };
  };
};

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

async function projectileCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.projectiles.projectiles.length,
  );
}

/** Sandbox spawns zero enemies and skips the survivors dodge/armor/shield rolls, so damage lands exactly. */
async function stageSandboxRun(page: Page): Promise<HudSnapshot> {
  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await page.evaluate(() => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.startSandbox();
    game.clearSandboxActors();
    game.ctx.status = "playing";
    game.sys.hud.emit();
  });
  await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("playing");
  return snapshot(page);
}

test.describe("projectile player hit", () => {
  test("an enemy projectile flies into the player and drops health by its damage", async ({ page }) => {
    const before = await stageSandboxRun(page);

    const spawn = await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const player = game.ctx.body.position;
      const origin = player.clone();
      origin.x += 2.4; // outside the 0.9 hit radius — only flight can land this
      const dir = player.clone().sub(origin).normalize(); // dead-on at the eye point, horizontal
      game.sys.projectiles.spawnProjectile({ origin, dir, damage: 8, speed: 6, fromBoss: false });
      return { count: game.sys.projectiles.projectiles.length, distance: origin.distanceTo(player) };
    });
    expect(spawn.count).toBe(1);
    expect(spawn.distance).toBeGreaterThan(0.9);

    await expect.poll(() => snapshot(page).then((state) => state.damageSeq)).toBe(before.damageSeq + 1);
    const after = await snapshot(page);
    expect(after.playerHealth).toBe(before.playerHealth - 8);
    expect(await projectileCount(page)).toBe(0); // consumed by the hit, not by TTL/bounds
  });

  test("a projectile aimed away misses, expires, and leaves health untouched", async ({ page }) => {
    const before = await stageSandboxRun(page);

    const spawned = await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const player = game.ctx.body.position;
      const origin = player.clone();
      origin.x += 2.4;
      const dir = origin.clone().sub(player).normalize(); // pointing away — flies out of the arena bounds
      game.sys.projectiles.spawnProjectile({ origin, dir, damage: 8, speed: 30, fromBoss: false });
      return game.sys.projectiles.projectiles.length;
    });
    expect(spawned).toBe(1);

    await expect.poll(() => projectileCount(page)).toBe(0); // reaped by the integrator, never by a hit

    const after = await snapshot(page);
    expect(after.damageSeq).toBe(before.damageSeq);
    expect(after.playerHealth).toBe(before.playerHealth);
  });
});
