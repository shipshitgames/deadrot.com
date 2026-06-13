import { expect, type Page, test } from "@playwright/test";

/** Just the weapon-tier slice of the HUD snapshot this spec asserts on (#279). */
type TierSnapshot = {
  status: string;
  survivors: boolean;
  banner: string;
  bannerSeq: number;
  survivorWeaponTier: string;
  survivorWeaponTierLabel: string;
  survivorWeaponTierIndex: number;
  survivorWeaponTierDamageMul: number;
};

async function snapshot(page: Page): Promise<TierSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => TierSnapshot }).__hudSnapshot());
}

async function waitForGame(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
}

test.describe("scourge weapon tiers", () => {
  test("a real run surfaces the live weapon tier and its damage multiplier in the HUD", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("PointerLockControls: Unable to use Pointer Lock API")) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/");
    await waitForGame(page);

    // A fresh run starts at the base tier: neutral multiplier, first pip lit.
    await page.evaluate(() => {
      type DevGame = {
        startSurvivors: (classId?: "ranger") => void;
        ctx: { status: string };
        sys: { hud: { emit: () => void } };
      };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.startSurvivors("ranger");
      game.ctx.status = "playing";
      game.sys.hud.emit();
    });

    await expect.poll(() => snapshot(page).then((s) => s.survivors)).toBe(true);
    const baseState = await snapshot(page);
    expect(baseState.survivorWeaponTier).toBe("base");
    expect(baseState.survivorWeaponTierLabel).toBe("TIER I");
    expect(baseState.survivorWeaponTierIndex).toBe(0);
    expect(baseState.survivorWeaponTierDamageMul).toBe(1);
    await expect(page.getByTestId("survivor-weapon-tier")).toContainText("TIER I");
    await expect(page.getByTestId("survivor-weapon-tier")).toContainText("×1.00");

    // Stacking four offensive picks (dmg) advances the build to tier-3, which both
    // relabels the HUD badge and raises the reported gun-damage multiplier (#279).
    await page.evaluate(() => {
      type DevGame = {
        sys: {
          survivors: { upgradeLevels: Record<string, number>; recomputeStats: () => void };
          hud: { emit: () => void };
        };
      };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.sys.survivors.upgradeLevels = { dmg: 4 };
      game.sys.survivors.recomputeStats();
      game.sys.hud.emit();
    });

    await expect.poll(() => snapshot(page).then((s) => s.survivorWeaponTier)).toBe("tier-3");
    const builtState = await snapshot(page);
    expect(builtState.survivorWeaponTierLabel).toBe("TIER III");
    expect(builtState.survivorWeaponTierIndex).toBe(2);
    expect(builtState.survivorWeaponTierDamageMul).toBeCloseTo(1.18, 5);
    await expect(page.getByTestId("survivor-weapon-tier")).toContainText("TIER III");
    await expect(page.getByTestId("survivor-weapon-tier")).toContainText("×1.18");

    expect(consoleErrors).toEqual([]);
  });

  test("crossing a tier in the draft defers the power-spike banner until the run resumes", async ({ page }) => {
    await page.goto("/");
    await waitForGame(page);

    // Resolve a single-level draft with an offensive pick. The pick crosses base -> tier-2,
    // but the banner must fire only once the draft closes and status flips back to "playing"
    // (so it never plays behind the level-up overlay), alongside the power-cue sfx (#279).
    const result = await page.evaluate(() => {
      type DevGame = {
        startSurvivors: (classId?: "ranger") => void;
        ctx: { status: string };
        sys: {
          hud: { emit: () => void };
          input: { requestLock: () => void };
          survivors: {
            upgradeLevels: Record<string, number>;
            pendingLevels: number;
            rollChoices: () => void;
            pickUpgrade: (id: string) => void;
          };
        };
      };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const audio = (window as unknown as { __fpsAudio: { sfx: (id: string) => void } }).__fpsAudio;

      const sfx: string[] = [];
      audio.sfx = (id: string) => sfx.push(id);
      // The headless harness can't grant pointer lock; stub it so the resolve path completes.
      game.sys.input.requestLock = () => {};

      game.startSurvivors("ranger");
      game.sys.survivors.upgradeLevels = {};
      game.sys.survivors.pendingLevels = 1;
      game.ctx.status = "levelup";
      game.sys.survivors.rollChoices();
      game.sys.hud.emit();

      // While the draft is open, the banner has NOT fired yet (it is queued).
      const bannerDuringDraft = (window as unknown as { __hudSnapshot: () => { banner: string } }).__hudSnapshot()
        .banner;

      game.sys.survivors.pickUpgrade("dmg");
      return { sfx, dmgLevel: game.sys.survivors.upgradeLevels.dmg ?? 0, bannerDuringDraft };
    });

    // The banner was not shown behind the open draft overlay.
    expect(result.bannerDuringDraft).not.toContain("TIER II");
    // The pick actually advanced the offensive build by exactly one level.
    expect(result.dmgLevel).toBe(1);

    // The draft closed: the run is live, the tier advanced, and the banner now shows.
    const state = await snapshot(page);
    expect(state.status).toBe("playing");
    expect(state.survivorWeaponTier).toBe("tier-2");
    expect(state.survivorWeaponTierLabel).toBe("TIER II");
    expect(state.banner).toContain("WEAPON");
    expect(state.banner).toContain("TIER II");
    expect(state.bannerSeq).toBeGreaterThan(0);
    // The power-cue plays with the banner so the spike is audible as well as visible.
    expect(result.sfx).toContain("berserk");
  });

  test("the dev sandbox reports the gun-damage multiplier for each selectable tier", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await waitForGame(page);

    const readout = page.getByTestId("sandbox-tier-dmg");
    await expect(readout).toBeVisible();
    await expect(readout).toContainText("TIER I");
    await expect(readout).toContainText("×1.00");

    const tiers = page.locator("section").filter({ hasText: "Weapons" });
    await tiers.getByRole("button", { name: /^T3$/ }).click();
    await expect(readout).toContainText("TIER III");
    await expect(readout).toContainText("×1.18");

    await tiers.getByRole("button", { name: /^Evo$/ }).click();
    await expect(readout).toContainText("EVOLVED");
    await expect(readout).toContainText("×1.45");

    // The selected tier drives the live gun-damage tier the weapon system reads.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __fpsGame: { ctx: { sandboxWeaponTier: string } } }).__fpsGame.ctx
              .sandboxWeaponTier,
        ),
      )
      .toBe("evolved");
  });

  test("advancing the weapon tier multiplies the damage actually dealt to an enemy", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await waitForGame(page);

    // Drive the real WeaponSystem.doMelee against a parked dummy and read the health it
    // actually loses. This proves the tier mul reaches live combat — not just the HUD (#279).
    const damage = await page.evaluate(() => {
      type Enemy = {
        alive: boolean;
        health: number;
        maxHealth: number;
        shielded: boolean;
        overshield: number;
        position: { y: number; set: (x: number, y: number, z: number) => void };
      };
      type DevGame = {
        startSandbox: () => void;
        clearSandboxActors: () => void;
        spawnSandboxEnemy: (kind: string, count?: number) => void;
        ctx: {
          status: string;
          statCrit: number;
          statDamageMul: number;
          damageBoostTimer: number;
          sandboxWeaponTier: string;
          rig: { facing: { identity: () => void } };
          body: { position: { x: number; z: number } };
          enemies: Enemy[];
        };
        sys: { weapon: { doMelee: () => void } };
      };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.startSandbox();
      game.ctx.status = "playing";
      // Make the swing deterministic: face -Z, no crit roll, no global dmg buff, no berserk.
      game.ctx.rig.facing.identity();
      game.ctx.statCrit = 0;
      game.ctx.statDamageMul = 1;
      game.ctx.damageBoostTimer = 0;

      const measure = (tier: string): number => {
        game.clearSandboxActors();
        game.spawnSandboxEnemy("melee", 1);
        const enemy = game.ctx.enemies.find((e) => e.alive);
        if (!enemy) throw new Error("no sandbox enemy spawned");
        // A fat, un-shielded dummy parked 1.2u directly ahead so one swing connects cleanly.
        enemy.maxHealth = 1_000_000;
        enemy.health = 1_000_000;
        enemy.shielded = false;
        enemy.overshield = 0;
        enemy.position.set(game.ctx.body.position.x, enemy.position.y, game.ctx.body.position.z - 1.2);
        game.ctx.sandboxWeaponTier = tier;
        const before = enemy.health;
        game.sys.weapon.doMelee();
        return before - enemy.health;
      };

      return { base: measure("base"), evolved: measure("evolved") };
    });

    expect(damage.base).toBeGreaterThan(0);
    expect(damage.evolved).toBeGreaterThan(damage.base);
    // Evolved is the documented ×1.45 spike over the neutral base swing.
    expect(damage.evolved / damage.base).toBeCloseTo(1.45, 5);
  });
});
