import { expect, type Page, test } from "@playwright/test";

/**
 * End-to-end gate for the extracted wave director (issue #92): drive a real
 * campaign through the genuine {@link PveDirectorSystem} → shared `WaveDirector`
 * and assert the full pacing loop still runs — every tuned wave spawns, kills
 * count toward the goal via the neutral `notifyProgress` seam, the inter-wave
 * breaks gate progression, and the breach boss hands off after the final wave
 * and is defeatable. This is the "full wave run + boss + win" playtest gate.
 */

type WaveRunResult = {
  bossActive: boolean;
  bossEnemyPresent: boolean;
  waveIndex: number;
  totalWaves: number;
  kills: number;
  iterations: number;
};

async function runCampaignToBoss(page: Page): Promise<WaveRunResult> {
  return page.evaluate(() => {
    type DevEnemy = {
      alive: boolean;
      health: number;
      isBoss: boolean;
      takeDamage: (
        amount: number,
        headshot: boolean,
        knockback: number,
        dirX: number,
        dirZ: number,
      ) => { died: boolean; blocked: boolean };
    };
    type DevGame = {
      startCampaign: (mapId?: string) => void;
      ctx: { status: string; kills: number; enemies: DevEnemy[]; aliveCount: number };
      sys: {
        pve: {
          waveIndex: number;
          bossActive: boolean;
          bossEnemy: DevEnemy | null;
          startWaveSystem: () => void;
          updateWaves: (delta: number) => void;
          onEnemyDeath: (enemy: DevEnemy, headshot: boolean) => void;
        };
      };
    };

    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.startCampaign();
    game.ctx.status = "playing";
    // Fresh director state so the run is deterministic regardless of menu flow.
    game.sys.pve.startWaveSystem();

    // Reap every alive normal enemy, routing each defeat through the real death
    // path (takeDamage marks it dead → onEnemyDeath tallies wave progress). The
    // boss is left standing so the loop can observe the hand-off — defeating it
    // here would clear `bossActive`, since the director owns the boss phase and
    // never re-spawns one.
    const reap = () => {
      for (const enemy of game.ctx.enemies) {
        if (!enemy.alive || enemy.isBoss) continue;
        const res = enemy.takeDamage(enemy.health + 1, false, 6, 1, 0);
        if (res.died) game.sys.pve.onEnemyDeath(enemy, false);
      }
    };

    // Pump in 1s steps (> spawn interval and > wave break) and clear the field
    // each step, mimicking a player who instantly defeats every spawn. The
    // guard bounds the loop so a regression can never hang the test.
    let iterations = 0;
    while (!game.sys.pve.bossActive && iterations < 5000) {
      game.sys.pve.updateWaves(1);
      reap();
      iterations++;
    }

    return {
      bossActive: game.sys.pve.bossActive,
      bossEnemyPresent: game.sys.pve.bossEnemy !== null,
      waveIndex: game.sys.pve.waveIndex,
      totalWaves: 3,
      kills: game.ctx.kills,
      iterations,
    };
  });
}

test.describe("campaign wave director", () => {
  test("runs every wave to the breach boss and the boss is defeatable", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("PointerLockControls: Unable to use Pointer Lock API")) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    const run = await runCampaignToBoss(page);

    // The director advanced past the final normal wave into the boss phase.
    expect(run.waveIndex).toBe(run.totalWaves);
    expect(run.bossActive).toBe(true);
    expect(run.bossEnemyPresent).toBe(true);
    // Every tuned wave's full count was spawned and defeated (6 + 9 + 12).
    expect(run.kills).toBeGreaterThanOrEqual(27);
    // The pump terminated well within its guard — no stagger-gate stall.
    expect(run.iterations).toBeLessThan(5000);

    // The breach boss can be defeated, clearing the boss-active flag (the win).
    const afterBoss = await page.evaluate(() => {
      type DevEnemy = {
        alive: boolean;
        health: number;
        takeDamage: (
          amount: number,
          headshot: boolean,
          knockback: number,
          dirX: number,
          dirZ: number,
        ) => { died: boolean; blocked: boolean };
      };
      type DevGame = {
        ctx: { bossKills: number };
        sys: {
          pve: {
            bossActive: boolean;
            bossEnemy: DevEnemy | null;
            onEnemyDeath: (enemy: DevEnemy, headshot: boolean) => void;
          };
        };
      };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const boss = game.sys.pve.bossEnemy;
      if (boss) {
        const res = boss.takeDamage(boss.health + 1, false, 6, 1, 0);
        if (res.died) game.sys.pve.onEnemyDeath(boss, false);
      }
      return { bossActive: game.sys.pve.bossActive, bossKills: game.ctx.bossKills };
    });

    expect(afterBoss.bossKills).toBeGreaterThanOrEqual(1);
    expect(afterBoss.bossActive).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});
