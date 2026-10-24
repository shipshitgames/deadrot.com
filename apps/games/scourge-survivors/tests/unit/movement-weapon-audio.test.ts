// The `jump`, `land` and `dryfire` cues all existed in DEADROT_SFX_PALETTE but
// nothing in the game ever fired them, so three of the loudest moments in an FPS
// were silent: you left the ground without a sound, you hit it without a sound,
// and — worst of the three — pulling the trigger on a dead gun produced nothing
// at all, which reads as broken input rather than an empty pouch.
//
// These tests pin the wiring at the choke points that own each moment, not at
// the call sites that happen to reach them today: tryJump() for both the
// spacebar and the touch button, updateLanding()'s existing impact edge, and
// startReload()'s refusal.

import { describe, expect, it, vi } from "vitest";
import { DRY_FIRE_INTERVAL } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import type { GameSystems } from "../../src/game/systems";
import { InputSystem } from "../../src/game/systems/InputSystem";

const sfxLog = vi.hoisted(() => [] as { name: string; gain?: number }[]);

vi.mock("../../src/audio/AudioEngine", () => ({
  audio: {
    sfx: (name: string, opts: { gain?: number } = {}) => sfxLog.push({ name, gain: opts.gain }),
  },
}));

function jumpHarness(canJump: boolean) {
  sfxLog.length = 0;
  const ctx = {
    canJump,
    velocity: { x: 0, y: 0, z: 0 },
  } as unknown as GameContext;
  const input = new InputSystem(ctx, {} as GameSystems);
  return { ctx, input };
}

describe("jump audio", () => {
  it("cues the launch once per successful jump", () => {
    const { ctx, input } = jumpHarness(true);

    input.tryJump();

    expect(sfxLog.map((e) => e.name)).toEqual(["jump"]);
    expect(ctx.velocity.y).toBeGreaterThan(0);
    expect(ctx.canJump).toBe(false);
  });

  it("stays silent when the ground check refuses the jump", () => {
    // Holding space mid-air must not machine-gun the cue: a jump that never
    // happens must not sound like one that did.
    const { input } = jumpHarness(false);

    input.tryJump();
    input.tryJump();

    expect(sfxLog).toEqual([]);
  });
});

describe("landing audio", () => {
  /** Drive one updateLanding tick with an explicit airborne history. */
  async function land(fallSpeed: number, grounded: boolean) {
    const { weapon, ctx } = await weaponHarness({ ammo: 1, reserve: 1, survivors: false });
    ctx.canJump = grounded;
    ctx.velocity = { x: 0, y: 0, z: 0 } as GameContext["velocity"];
    Object.assign(weapon, {
      previousGrounded: false,
      previousVerticalVelocity: fallSpeed,
      landingAge: 999,
      landingVelocity: 0,
    });
    (weapon as unknown as { updateLanding(d: number): void }).updateLanding(0.016);
    return sfxLog;
  }

  it("thuds on the frame the boots touch down", async () => {
    expect((await land(-8, true)).map((e) => e.name)).toEqual(["land"]);
  });

  it("stays silent stepping off a stair lip", async () => {
    // The -0.5 gate is what keeps stairs and kerbs from clattering. Multi-storey
    // arenas mean the player crosses these constantly.
    expect(await land(-0.2, true)).toEqual([]);
  });

  it("stays silent while still airborne", async () => {
    expect(await land(-8, false)).toEqual([]);
  });

  it("scales the thud with the drop", async () => {
    const soft = (await land(-2, true))[0].gain as number;
    const hard = (await land(-18, true))[0].gain as number;
    expect(hard).toBeGreaterThan(soft);
    expect(hard).toBeLessThanOrEqual(1);
    expect(soft).toBeGreaterThan(0);
  });
});

describe("dry-fire audio", () => {
  it("clicks when the reserve is gone instead of answering with silence", async () => {
    const { weapon, ctx } = await weaponHarness({ ammo: 0, reserve: 0, survivors: false });
    ctx.firing = true;

    weapon.tickFireReload(0.016);

    expect(sfxLog.map((e) => e.name)).toEqual(["dryfire"]);
    expect(ctx.reloading).toBe(false);
  });

  it("paces the click by the fire cooldown while the trigger is held", async () => {
    const { weapon, ctx } = await weaponHarness({ ammo: 0, reserve: 0, survivors: false });
    ctx.firing = true;

    weapon.tickFireReload(0.016); // clicks, then arms the interval
    weapon.tickFireReload(0.016); // still cooling down — silent
    expect(sfxLog).toHaveLength(1);

    weapon.tickFireReload(DRY_FIRE_INTERVAL); // interval elapsed — clicks again
    expect(sfxLog.map((e) => e.name)).toEqual(["dryfire", "dryfire"]);
  });

  it("reloads rather than clicking while the reserve still holds rounds", async () => {
    const { weapon, ctx } = await weaponHarness({ ammo: 0, reserve: 30, survivors: false });
    ctx.firing = true;

    weapon.tickFireReload(0.016);

    expect(sfxLog.map((e) => e.name)).toEqual(["reload"]);
    expect(ctx.reloading).toBe(true);
  });

  it("never dry-fires in Survivors, where the reserve is infinite", async () => {
    const { weapon, ctx } = await weaponHarness({ ammo: 0, reserve: 0, survivors: true });
    ctx.firing = true;

    weapon.tickFireReload(0.016);

    expect(sfxLog.map((e) => e.name)).toEqual(["reload"]);
  });
});

/**
 * Build a WeaponSystem far enough to drive {@link WeaponSystem.tickFireReload}.
 *
 * Imported lazily so the AudioEngine mock above is installed before the module
 * graph pulls it in.
 */
async function weaponHarness(over: { ammo: number; reserve: number; survivors: boolean }) {
  sfxLog.length = 0;
  const { WeaponSystem } = await import("../../src/game/entities/WeaponSystem");
  const ctx = {
    activeWeapon: "pistol",
    ammo: over.ammo,
    reserve: over.reserve,
    survivors: over.survivors,
    reloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    firing: false,
    triggerQueued: false,
    aimingDownSights: false,
  } as unknown as GameContext;
  const sys = { hud: { emit: () => {} } } as unknown as GameSystems;
  const weapon = Object.create(WeaponSystem.prototype) as InstanceType<typeof WeaponSystem>;
  Object.assign(weapon, { ctx, sys });
  return { ctx, sys, weapon };
}
