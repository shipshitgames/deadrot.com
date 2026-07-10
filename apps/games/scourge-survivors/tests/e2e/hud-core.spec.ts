import { expect, type Page, test } from "@playwright/test";

// Coverage for the extracted genre-neutral HUD core (@deadrot/game-kit/hud, #93).
// Scourge's HudSystem now subclasses the engine's HudCoreSystem, so these specs
// drive the live game surface and assert the engine-owned channels — vitals,
// the monotonic feedback counters, the centre banner / pickup toast, and the
// world→screen floating combat numbers — all flow through to the React HUD frame
// exactly as before the extraction.

type FloatNumber = { id: number; x: number; y: number; amount: number; kind: "normal" | "head" | "crit" };

type HudSnapshot = {
  status: string;
  playerHealth: number;
  maxPlayerHealth: number;
  hitSeq: number;
  emphasisSeq: number;
  killSeq: number;
  damageSeq: number;
  banner: string;
  bannerSeq: number;
  toast: string;
  toastSeq: number;
  damageNumbers: FloatNumber[];
};

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

/** Boot the dev sandbox into an active, emitting run. */
async function bootPlaying(page: Page) {
  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await page.evaluate(async () => {
    type DevGame = {
      startSandbox: () => void;
      ctx: { status: string; health: number };
      sys: { hud: { emit: () => void } };
    };
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    await game.startSandbox();
    game.ctx.status = "playing";
    game.sys.hud.emit();
  });
  await expect.poll(() => snapshot(page).then((s) => s.status)).toBe("playing");
}

test.describe("engine HUD core (extracted to game-kit)", () => {
  test("vitals and the monotonic feedback channels flow through the live frame", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("PointerLockControls")) consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await bootPlaying(page);

    // Engine-owned vitals: the extension's vitals() feeds playerHealth/maxPlayerHealth.
    await page.evaluate(() => {
      type DevGame = { ctx: { health: number }; sys: { hud: { emit: () => void } } };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.ctx.health = 55;
      game.sys.hud.emit();
    });
    const vit = await snapshot(page);
    expect(vit.playerHealth).toBe(55);
    expect(vit.maxPlayerHealth).toBeGreaterThanOrEqual(vit.playerHealth);

    // Engine-owned feedback channels: producers just bump the counter then emit().
    const before = await snapshot(page);
    const after = await page.evaluate(() => {
      type DevHud = {
        hitSeq: number;
        emphasisSeq: number;
        killSeq: number;
        damageSeq: number;
        emit: () => void;
      };
      const hud = (window as unknown as { __fpsGame: { sys: { hud: DevHud } } }).__fpsGame.sys.hud;
      hud.hitSeq += 1;
      hud.emphasisSeq += 2;
      hud.killSeq += 3;
      hud.damageSeq += 1;
      hud.emit();
      return {
        hitSeq: hud.hitSeq,
        emphasisSeq: hud.emphasisSeq,
        killSeq: hud.killSeq,
        damageSeq: hud.damageSeq,
      };
    });
    const channels = await snapshot(page);
    expect(channels.hitSeq).toBe(before.hitSeq + 1);
    expect(channels.emphasisSeq).toBe(before.emphasisSeq + 2);
    expect(channels.killSeq).toBe(before.killSeq + 3);
    expect(channels.damageSeq).toBe(before.damageSeq + 1);
    // The counters only ever climb — the snapshot agrees with the system fields.
    expect(channels).toMatchObject(after);

    expect(consoleErrors).toEqual([]);
  });

  test("announce() raises the centre banner and showToast() the pickup toast", async ({ page }) => {
    await bootPlaying(page);

    const beforeBanner = (await snapshot(page)).bannerSeq;
    await page.evaluate(() => {
      type DevHud = { announce: (text: string) => void };
      (window as unknown as { __fpsGame: { sys: { hud: DevHud } } }).__fpsGame.sys.hud.announce("WAVE 2");
    });
    await expect.poll(() => snapshot(page).then((s) => s.banner)).toBe("WAVE 2");
    expect((await snapshot(page)).bannerSeq).toBe(beforeBanner + 1);
    // The engine banner drives the React combat banner.
    await expect(page.locator(".scourge-combat-banner")).toHaveText("WAVE 2");

    const beforeToast = (await snapshot(page)).toastSeq;
    await page.evaluate(() => {
      type DevHud = { showToast: (text: string) => void };
      (window as unknown as { __fpsGame: { sys: { hud: DevHud } } }).__fpsGame.sys.hud.showToast("+ SHOTGUN");
    });
    await expect.poll(() => snapshot(page).then((s) => s.toast)).toBe("+ SHOTGUN");
    expect((await snapshot(page)).toastSeq).toBe(beforeToast + 1);
    await expect(page.locator(".scourge-combat-toast")).toHaveText("+ SHOTGUN");
  });

  test("world-space combat numbers project onto the HUD frame", async ({ page }) => {
    await bootPlaying(page);

    // Add a float at a point a few metres in front of the camera and read it back
    // in the same step, before its TTL can prune it.
    const floats = await page.evaluate(() => {
      type Vec3 = {
        clone: () => Vec3;
        addScaledVector: (v: Vec3, s: number) => Vec3;
      };
      type DevGame = {
        ctx: { body: { position: Vec3 }; camera: { getWorldDirection: (target: Vec3) => Vec3 }; _dir: Vec3 };
        sys: { hud: { addDamageNumber: (world: Vec3, amount: number, kind: string) => void; emit: () => void } };
      };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const forward = game.ctx.camera.getWorldDirection(game.ctx._dir.clone());
      const target = game.ctx.body.position.clone().addScaledVector(forward, 6);
      game.sys.hud.addDamageNumber(target, 25, "crit");
      game.sys.hud.emit();
      return (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot().damageNumbers;
    });

    expect(floats.length).toBeGreaterThan(0);
    const float = floats.at(-1)!;
    expect(float.amount).toBe(25);
    expect(float.kind).toBe("crit");
    // Projected to a screen percentage inside the viewport.
    expect(float.x).toBeGreaterThan(0);
    expect(float.x).toBeLessThan(100);
    expect(float.y).toBeGreaterThan(0);
    expect(float.y).toBeLessThan(100);
  });
});
