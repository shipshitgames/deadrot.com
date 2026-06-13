// Shared cross-game War-Effort buff (#280), Scourge reference implementation.
//
// Two seams are covered here:
//  1. `runBiomass` — the pure derivation of how much war resource (biomass) a
//     finished run banks into the shared Warline pool.
//  2. `SurvivorsSystem.autoDamageEnemy` — proof that `ctx.warEffortDamageMul`
//     actually scales outgoing damage (the player-facing bonus the pool drives).
import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { MELEE_DAMAGE } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import { RUN_BIOMASS_CAP, runBiomass } from "../../src/game/data/survivors";
import type { Enemy } from "../../src/game/entities/Enemy";
import type { GameSystems } from "../../src/game/systems";

// SurvivorsSystem and WeaponSystem statically pull spriteAssets (module-scope
// THREE.TextureLoader → document.createElementNS), so we shim that single DOM hook
// before importing them, exactly as projectile-combat.test.ts does.
type SurvivorsModule = typeof import("../../src/game/modes/SurvivorsSystem");
type WeaponModule = typeof import("../../src/game/entities/WeaponSystem");
let SurvivorsSystem: SurvivorsModule["SurvivorsSystem"];
let WeaponSystem: WeaponModule["WeaponSystem"];

beforeAll(async () => {
  if (typeof (globalThis as { document?: unknown }).document === "undefined") {
    (globalThis as { document?: unknown }).document = {
      createElementNS() {
        return {
          addEventListener() {},
          removeEventListener() {},
          set crossOrigin(_value: string) {},
          set src(_value: string) {},
        };
      },
    };
  }
  SurvivorsSystem = (await import("../../src/game/modes/SurvivorsSystem")).SurvivorsSystem;
  WeaponSystem = (await import("../../src/game/entities/WeaponSystem")).WeaponSystem;
});

describe("runBiomass — shared war-resource contribution (#280)", () => {
  it("is zero for an empty run and floors negatives to zero", () => {
    expect(runBiomass(0, 0, 0)).toBe(0);
    expect(runBiomass(-100, -100, -100)).toBe(0);
  });

  it("matches the documented harvest formula (kills*1.5 + level*8 + time*0.6)", () => {
    // floor(100*1.5 + 10*8 + 200*0.6) = floor(150 + 80 + 120) = 350
    expect(runBiomass(100, 10, 200)).toBe(350);
  });

  it("rewards more kills, level, and survival time monotonically", () => {
    expect(runBiomass(200, 10, 200)).toBeGreaterThan(runBiomass(100, 10, 200)); // kills
    expect(runBiomass(100, 20, 200)).toBeGreaterThan(runBiomass(100, 10, 200)); // level
    expect(runBiomass(100, 10, 400)).toBeGreaterThan(runBiomass(100, 10, 200)); // time
  });

  it("hard-caps any single run so no one run can swing the global war effort", () => {
    expect(runBiomass(1_000_000, 1_000_000, 1_000_000)).toBe(RUN_BIOMASS_CAP);
    // The cap sits well under Warline's unitPerTier (5000) — banking a whole
    // tier is a collective effort, never a one-run feat.
    expect(RUN_BIOMASS_CAP).toBe(2500);
    expect(RUN_BIOMASS_CAP).toBeLessThan(5000);
  });
});

/** A fake enemy that records every damage amount `takeDamage` is dealt. */
function recordingEnemy() {
  const dealt: number[] = [];
  const enemy = {
    alive: true,
    radius: 0.5,
    position: new THREE.Vector3(0, 1, 0),
    takeDamage: (amount: number) => {
      dealt.push(amount);
      return { died: false, headshot: false, blocked: false };
    },
  } as unknown as Enemy;
  return { enemy, dealt };
}

/** A SurvivorsSystem wired to the bare minimum needed by `autoDamageEnemy`. */
function survivorsWith(opts: { warEffortDamageMul: number; statDamageMul?: number; statAmp?: number }) {
  const ctx = {
    statCrit: 0, // no crit so the dealt damage is deterministic
    statDamageMul: opts.statDamageMul ?? 1,
    warEffortDamageMul: opts.warEffortDamageMul,
  } as unknown as GameContext;
  const sys = {
    hud: { addDamageNumber: () => {} },
    fx: { spawnBloodHit: () => {} },
    pve: { onEnemyDeath: () => {} },
  } as unknown as GameSystems;
  const survivors = new SurvivorsSystem(ctx, sys);
  survivors.statAmp = opts.statAmp ?? 1;
  return survivors;
}

describe("warEffortDamageMul scales outgoing damage (#280)", () => {
  it("leaves damage unchanged at the neutral 1x multiplier", () => {
    const survivors = survivorsWith({ warEffortDamageMul: 1 });
    const { enemy, dealt } = recordingEnemy();
    survivors.autoDamageEnemy(enemy, 100);
    expect(dealt[0]).toBeCloseTo(100, 6);
  });

  it("multiplies outgoing damage by the shared war-effort bonus", () => {
    for (const mult of [1.04, 1.2, 1.4]) {
      const survivors = survivorsWith({ warEffortDamageMul: mult });
      const { enemy, dealt } = recordingEnemy();
      survivors.autoDamageEnemy(enemy, 100);
      expect(dealt[0]).toBeCloseTo(100 * mult, 6);
    }
  });

  it("composes multiplicatively alongside statDamageMul and statAmp", () => {
    const survivors = survivorsWith({ warEffortDamageMul: 1.2, statDamageMul: 2, statAmp: 1.5 });
    const { enemy, dealt } = recordingEnemy();
    survivors.autoDamageEnemy(enemy, 100);
    // 100 * statDamageMul(2) * warEffort(1.2) * statAmp(1.5) = 360
    expect(dealt[0]).toBeCloseTo(360, 6);
  });
});

/** A WeaponSystem wired to the bare minimum `doMelee` reads, with one enemy in range. */
function meleeWith(opts: { warEffortDamageMul: number; statDamageMul?: number; enemy: Enemy }) {
  const ctx = {
    status: "playing",
    damageBoostTimer: 0, // no berserk → DAMAGE_BOOST_MULT factor is 1
    statCrit: 0, // no crit so the dealt damage is deterministic
    statDamageMul: opts.statDamageMul ?? 1,
    warEffortDamageMul: opts.warEffortDamageMul,
    _fwd: new THREE.Vector3(),
    rig: { facing: new THREE.Quaternion() },
    body: { position: new THREE.Vector3(0, 0, 0) },
    enemies: [opts.enemy], // sits at the player's XZ → inside MELEE_RANGE, in-arc
    multiplayer: false, // skip the remote-player melee branch
  } as unknown as GameContext;
  const sys = {
    hud: { addDamageNumber: () => {}, hitMarkerSeq: 0, emit: () => {} },
    fx: { spawnBloodHit: () => {}, addShake: () => {} },
    pve: { onEnemyDeath: () => {} },
  } as unknown as GameSystems;
  return new WeaponSystem(ctx, sys);
}

describe("warEffortDamageMul scales melee weapon damage (#280)", () => {
  it("multiplies MELEE_DAMAGE by the shared war-effort bonus", () => {
    for (const mult of [1, 1.2, 1.4]) {
      const { enemy, dealt } = recordingEnemy();
      meleeWith({ warEffortDamageMul: mult, enemy }).doMelee();
      expect(dealt[0]).toBeCloseTo(MELEE_DAMAGE * mult, 6);
    }
  });

  it("composes multiplicatively with statDamageMul at the melee site", () => {
    const { enemy, dealt } = recordingEnemy();
    meleeWith({ warEffortDamageMul: 1.2, statDamageMul: 2, enemy }).doMelee();
    // MELEE_DAMAGE * statDamageMul(2) * warEffort(1.2)
    expect(dealt[0]).toBeCloseTo(MELEE_DAMAGE * 2 * 1.2, 6);
  });
});
