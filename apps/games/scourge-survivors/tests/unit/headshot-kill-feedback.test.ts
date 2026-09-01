// Headshot-kill feedback beat (#417): a lethal headshot layers a shared
// "skull-pop" FX beat on top of the normal death animation. The single trigger
// lives in PveDirectorSystem.onEnemyDeath (every kill source funnels through it),
// and the beat itself is FxSystem.spawnHeadshotKillFx. This file covers both
// sides: the hook (real PveDirectorSystem + recording fakes, the
// reaper-encounter.test.ts harness pattern) and the beat (first direct FxSystem
// test, fake scene + mocked spriteAssets so it loads under node).

import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENEMY_SCORE } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import type { Enemy } from "../../src/game/entities/Enemy";
import { FxSystem } from "../../src/game/entities/FxSystem";
import { PveDirectorSystem } from "../../src/game/modes/PveDirectorSystem";
import type { GameSystems } from "../../src/game/systems";

const sfxLog = vi.hoisted(() => [] as string[]);

vi.mock("../../src/audio/AudioEngine", () => ({
  audio: { sfx: (name: string) => sfxLog.push(name) },
}));

vi.mock("../../src/game/spriteAssets", async () => {
  const { Texture } = await import("three");
  const tex = () => new Texture();
  return {
    PROJECTILE_SPRITE_TEXTURES: { enemy: tex(), boss: tex(), bolt: tex(), orb: tex() },
    XP_BLOOD_TEXTURE: tex(),
    XP_BLOOD_SCALE: [0.62, 0.62] as [number, number],
    CORPSE_PART_SPRITES: Array.from({ length: 6 }, () => ({ texture: tex(), scale: [0.5, 0.5] as [number, number] })),
  };
});

type Mode = "sandbox" | "survivors" | "campaign";

/** Real PveDirectorSystem over plain-object fakes; fx records call order + opts. */
function directorHarness(mode: Mode) {
  const calls: string[] = [];
  const headshotKillCalls: { x: number; y: number; z: number; scale?: number; boss?: boolean; groundY?: number }[] = [];
  const explosionCalls: { radius?: number; shake?: number; hitstop?: number; groundY?: number }[] = [];
  const spawnDeathCalls: {
    x: number;
    y: number;
    z: number;
    headshot?: boolean;
    elite?: boolean;
    scale?: number;
    groundY?: number;
  }[] = [];
  /** Ground floor every secondary drop was told to sit on, in call order. */
  const dropGroundYs: number[] = [];
  /** Every split child's spawn: where it was put and which storey it inherited. */
  const splitSpawns: { x: number; z: number; groundHeight?: number }[] = [];
  /** `fromY` each surface resolve was asked to search from — the parent's floor. */
  const surfaceQueries: number[] = [];
  const survivors = {
    reaper: null as Enemy | null,
    isReaper(enemy: Enemy) {
      return this.reaper !== null && enemy === this.reaper;
    },
    enemyXp: new WeakMap<Enemy, number>(),
    dropXpGem: (_pos: THREE.Vector3, _value: number, groundY = 0) => {
      calls.push("survivors:dropXpGem");
      dropGroundYs.push(groundY);
    },
    onEliteKilled: (_pos: THREE.Vector3, groundY = 0) => {
      calls.push("survivors:onEliteKilled");
      dropGroundYs.push(groundY);
    },
    onEnemyKilled: () => calls.push("survivors:onEnemyKilled"),
    takeEliteSplitAllowance: () => 0,
  };
  const ctx = {
    sandbox: mode === "sandbox",
    survivors: mode === "survivors",
    campaign: mode === "campaign",
    status: "playing",
    activeWeapon: "pistol",
    kills: 0,
    bossKills: 0,
    score: 0,
    reserve: 0,
    aliveCount: 0,
    enemies: [] as Enemy[],
    bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  };
  const sys = {
    survivors,
    projectiles: { removeProjectilesFrom: () => calls.push("projectiles:removeFrom") },
    fx: {
      registerKill: () => 1,
      addShake: () => calls.push("fx:shake"),
      hitstop: () => calls.push("fx:hitstop"),
      spawnEnemyDeath: (
        pos: THREE.Vector3,
        opts: { headshot?: boolean; elite?: boolean; scale?: number; groundY?: number },
      ) => {
        calls.push("fx:spawnEnemyDeath");
        spawnDeathCalls.push({ ...opts, x: pos.x, y: pos.y, z: pos.z });
      },
      spawnHeadshotKillFx: (pos: THREE.Vector3, opts: { scale?: number; boss?: boolean; groundY?: number } = {}) => {
        calls.push("fx:headshotKill");
        headshotKillCalls.push({
          x: pos.x,
          y: pos.y,
          z: pos.z,
          scale: opts.scale,
          boss: opts.boss,
          groundY: opts.groundY,
        });
      },
      spawnExplosion: (_pos: THREE.Vector3, opts: (typeof explosionCalls)[number] = {}) => {
        calls.push("fx:spawnExplosion");
        explosionCalls.push({ radius: opts.radius, shake: opts.shake, hitstop: opts.hitstop, groundY: opts.groundY });
      },
    },
    hud: {
      killSeq: 0,
      announce: (text: string) => calls.push(`hud:announce:${text}`),
      showToast: (text: string) => calls.push(`hud:toast:${text}`),
    },
    gameOver: { gameOver: (outcome: "win" | "dead") => calls.push(`gameover:${outcome}`) },
    pickups: {
      spawnPickup: () => calls.push("pickups:spawn"),
      maybeDropPickup: (_pos: THREE.Vector3, groundY = 0) => {
        calls.push("pickups:maybe");
        dropGroundYs.push(groundY);
      },
    },
    mission: { onBossDefeated: () => calls.push("mission:onBossDefeated") },
    player: {
      // The real resolve picks the deck under (x, z) reachable from `fromY`. Here
      // it just echoes the storey back so the test can assert what was asked for.
      walkableSurfaceHeightNear: (_x: number, _z: number, fromY: number) => {
        surfaceQueries.push(fromY);
        return fromY;
      },
    },
  };
  const director = new PveDirectorSystem(ctx as unknown as GameContext, sys as unknown as GameSystems);
  /** Seed the enemy pool so split children come from fakes, not real Enemy rigs. */
  const seedPool = (count: number) => {
    for (let i = 0; i < count; i++) {
      ctx.enemies.push({
        alive: false,
        spawnAt: (x: number, z: number, cfg: { groundHeight?: number } = {}) => {
          splitSpawns.push({ x, z, groundHeight: cfg.groundHeight });
        },
      } as unknown as Enemy);
    }
  };
  return {
    calls,
    explosionCalls,
    headshotKillCalls,
    spawnDeathCalls,
    dropGroundYs,
    splitSpawns,
    surfaceQueries,
    seedPool,
    ctx,
    sys,
    survivors,
    director,
  };
}

/**
 * The pre-kill snapshot `deathFx()` hands back. `kill()` has already parked the
 * live group at y = -100 by the time `onEnemyDeath` runs, so this is the *only*
 * record of where the body actually fell — which is why the fakes below keep the
 * two apart.
 */
function corpseAt(kind: string, groundY: number, hover = 0) {
  return { kind, x: 3, y: groundY + hover, z: -4, groundY, yaw: 0, scale: 1, palette: {} };
}

/** A dying standard foe exactly as onEnemyDeath sees it (kill() already ran: y=-100). */
function fakeDeadGrunt(groundY = 0): Enemy {
  return {
    isBoss: false,
    alive: false,
    position: new THREE.Vector3(3, -100, -4),
    group: { scale: { x: 1 } },
    radius: 0.6,
    splitCount: 0,
    archetype: "grunt",
    eliteAffix: null,
    deathFx: () => ({ kind: "melee", corpse: corpseAt("melee", groundY) }),
  } as unknown as Enemy;
}

function fakeDeadBoss(groundY = 0): Enemy {
  return {
    isBoss: true,
    alive: false,
    position: new THREE.Vector3(3, -100, -4),
    group: { scale: { x: 2.6 } },
    radius: 1,
    splitCount: 0,
    archetype: "tank",
    eliteAffix: null,
    deathFx: () => ({ kind: "boss", corpse: corpseAt("boss", groundY) }),
  } as unknown as Enemy;
}

/** A splitter, whose brood has to inherit the storey the parent died on. */
function fakeDeadSplitter(groundY = 0): Enemy {
  return {
    isBoss: false,
    alive: false,
    position: new THREE.Vector3(3, -100, -4),
    group: { scale: { x: 1 } },
    radius: 0.6,
    splitCount: 2,
    maxHealth: 60,
    speed: 3,
    archetype: "splitter",
    eliteAffix: null,
    deathFx: () => ({ kind: "melee", corpse: corpseAt("melee", groundY) }),
  } as unknown as Enemy;
}

/** A flyer dies in the air: its body falls from `y`, its drops land on `groundY`. */
function fakeDeadFlyer(groundY = 0, hover = 2.5): Enemy {
  return {
    isBoss: false,
    alive: false,
    position: new THREE.Vector3(3, -100, -4),
    group: { scale: { x: 1 } },
    radius: 0.6,
    splitCount: 0,
    archetype: "flyer",
    eliteAffix: null,
    deathFx: () => ({ kind: "flyer", corpse: corpseAt("flyer", groundY, hover) }),
  } as unknown as Enemy;
}

beforeEach(() => {
  sfxLog.length = 0;
});

describe("onEnemyDeath headshot-kill hook", () => {
  it("fires exactly one beat on a lethal headshot, before the base death FX", () => {
    const h = directorHarness("sandbox");

    h.director.onEnemyDeath(fakeDeadGrunt(), true);

    expect(h.calls.filter((c) => c === "fx:headshotKill")).toHaveLength(1);
    expect(h.headshotKillCalls[0]).toMatchObject({ x: 3, z: -4, boss: false });
    // the beat LAYERS on the death animation, so it must not replace it
    expect(h.calls.indexOf("fx:headshotKill")).toBeLessThan(h.calls.indexOf("fx:spawnEnemyDeath"));
    expect(h.spawnDeathCalls[0]).toMatchObject({ headshot: true });
    expect(h.ctx.kills).toBe(1);
  });

  it("never fires for a non-headshot kill; the normal death path is untouched", () => {
    const h = directorHarness("sandbox");

    h.director.onEnemyDeath(fakeDeadGrunt(), false);

    expect(h.calls).not.toContain("fx:headshotKill");
    expect(h.calls).toContain("fx:spawnEnemyDeath");
    expect(h.ctx.kills).toBe(1);
  });

  it("stays FX-only in campaign: score is exactly ENEMY_SCORE + the existing headshot bonus", () => {
    const h = directorHarness("campaign");

    h.director.onEnemyDeath(fakeDeadGrunt(), true);

    expect(h.calls.filter((c) => c === "fx:headshotKill")).toHaveLength(1);
    expect(h.ctx.score).toBe(ENEMY_SCORE + 50); // no double-counting from the new hook
    expect(h.ctx.kills).toBe(1);
  });

  it("supports a campaign boss headshot kill without disturbing the boss death flow", () => {
    const h = directorHarness("campaign");
    const boss = fakeDeadBoss();
    h.director.bossActive = true;
    h.director.bossEnemy = boss;

    h.director.onEnemyDeath(boss, true);

    expect(h.headshotKillCalls).toEqual([{ x: 3, y: 0, z: -4, scale: 2.4, boss: true, groundY: 0 }]);
    // boss extras stay authoritative: shake + hitstop + explosion + defeat flow.
    // The camera juice now rides in on the blast's own options rather than two
    // separate fx calls — spawnExplosion applies both, so the kick a boss death
    // gives the camera is unchanged, it just arrives through one verb.
    expect(sfxLog).toContain("explosion");
    // the blast is sized off the corpse, so a bigger boss detonates bigger
    expect(h.explosionCalls).toEqual([{ radius: 2.6 * 2.4, shake: 0.45, hitstop: 0.06, groundY: 0 }]);
    expect(h.calls).toContain("mission:onBossDefeated");
    expect(h.director.bossActive).toBe(false);
    expect(h.director.bossEnemy).toBeNull();
  });

  it("fires the beat on a reaper headshot kill before the victory beat", () => {
    const h = directorHarness("survivors");
    const reaper = fakeDeadBoss();
    h.survivors.reaper = reaper;
    h.director.bossActive = true;
    h.director.bossEnemy = reaper;

    h.director.onEnemyDeath(reaper, true);

    expect(h.calls.filter((c) => c === "fx:headshotKill")).toHaveLength(1);
    expect(h.calls).toContain("gameover:win");
    expect(h.calls.indexOf("fx:headshotKill")).toBeLessThan(h.calls.indexOf("gameover:win"));
  });
});

// Buildings gave the arena a second storey, and onEnemyDeath is the single place
// every kill funnels through — so it is the single place a kill's whole aftermath
// either follows the body upstairs or gets left on the arena plane. The snapshot
// carries two distinct heights and both matter: `y` is where the body fell (air,
// for a flyer) and `groundY` is the deck under it, which is where splats, gems,
// drops and settling gibs belong.
describe("onEnemyDeath on an upper storey", () => {
  /** Slab height of a hab's first floor. */
  const FLOOR = 4;

  it("puts a campaign kill's whole aftermath on the floor it died on", () => {
    const h = directorHarness("campaign");

    h.director.onEnemyDeath(fakeDeadGrunt(FLOOR), true);

    // The body: at the snapshot's position, never at the y = -100 park.
    expect(h.spawnDeathCalls[0]).toMatchObject({ x: 3, y: FLOOR, z: -4, groundY: FLOOR });
    // The beat and the drop roll: both told the same floor.
    expect(h.headshotKillCalls[0]).toMatchObject({ y: FLOOR, groundY: FLOOR });
    expect(h.calls).toContain("pickups:maybe");
    expect(h.dropGroundYs).toEqual([FLOOR]);
  });

  it("keeps a Survivors gem on the upstairs deck rather than dropping it through the slab", () => {
    const h = directorHarness("survivors");

    h.director.onEnemyDeath(fakeDeadGrunt(FLOOR), false);

    expect(h.calls).toContain("survivors:dropXpGem");
    expect(h.dropGroundYs).toEqual([FLOOR]);
    expect(h.spawnDeathCalls[0]).toMatchObject({ groundY: FLOOR });
  });

  it("detonates an upstairs boss on its own floor, and drops its elite spoils there", () => {
    const h = directorHarness("survivors");
    const boss = fakeDeadBoss(FLOOR);
    h.director.bossActive = true;
    h.director.bossEnemy = boss;

    h.director.onEnemyDeath(boss, true);

    expect(h.explosionCalls).toEqual([{ radius: 2.6 * 2.4, shake: 0.45, hitstop: 0.06, groundY: FLOOR }]);
    expect(h.headshotKillCalls[0]).toMatchObject({ groundY: FLOOR, boss: true });
    // gem then elite spoils, both on the same deck
    expect(h.dropGroundYs).toEqual([FLOOR, FLOOR]);
  });

  it("hands a splitter's brood the storey its parent died on", () => {
    const h = directorHarness("survivors");
    h.seedPool(4);

    h.director.onEnemyDeath(fakeDeadSplitter(FLOOR), false);

    expect(h.splitSpawns).toHaveLength(2);
    // The resolve is asked to search from the parent's floor, not from 0 — a swarm
    // bursting out of a corpse upstairs must not fall to the arena plane.
    expect(h.surfaceQueries).toEqual([FLOOR, FLOOR]);
    for (const spawn of h.splitSpawns) expect(spawn.groundHeight).toBe(FLOOR);
    expect(h.calls).toContain("hud:toast:SPLITTER BROOD");
  });

  it("separates where a flyer died from the floor its remains belong on", () => {
    const h = directorHarness("survivors");
    const hover = 2.5;

    h.director.onEnemyDeath(fakeDeadFlyer(FLOOR, hover), false);

    // The corpse starts in the air it was shot down in…
    expect(h.spawnDeathCalls[0]).toMatchObject({ y: FLOOR + hover });
    // …and falls to the deck, not through it.
    expect(h.spawnDeathCalls[0].groundY).toBe(FLOOR);
    expect(h.dropGroundYs).toEqual([FLOOR]);
  });

  it("still treats the arena plane as floor 0 when nothing is elevated", () => {
    const h = directorHarness("campaign");

    h.director.onEnemyDeath(fakeDeadGrunt(), true);

    expect(h.spawnDeathCalls[0]).toMatchObject({ y: 0, groundY: 0 });
    expect(h.dropGroundYs).toEqual([0]);
  });
});

/** Minimal ctx/sys covering everything FxSystem reads in the paths under test. */
function fxHarness() {
  const scene = { add: vi.fn(), remove: vi.fn() };
  const ctx = {
    scene,
    time: 12.3,
    status: "playing",
    shakeTrauma: 0,
    camRecoil: 0,
    hitstopTimer: 0,
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
    damageBoostTimer: 0,
    muzzleTimer: 0,
    muzzleLight: { intensity: 0 },
    muzzleFlash: { visible: false },
    body: { position: new THREE.Vector3() },
  };
  const sys = {
    projectiles: { clearProjectiles: vi.fn() },
    pickups: { pickups: [], removePickup: vi.fn() },
  };
  const fx = new FxSystem(ctx as unknown as GameContext, sys as unknown as GameSystems);
  return { scene, ctx, sys, fx };
}

describe("FxSystem.spawnHeadshotKillFx seam", () => {
  it("spawns the beat from cloned scalars: pops at head height, seam snapshot recorded", () => {
    const { fx } = fxHarness();

    fx.spawnHeadshotKillFx(new THREE.Vector3(3, -100, 5), { scale: 1 });

    expect(fx.headshotKillSeq).toBe(1);
    expect(fx.lastHeadshotKill).toEqual({ x: 3, z: 5, scale: 1, boss: false, at: 12.3 });
    expect(fx.pops).toHaveLength(8); // core + shell + 6 fountain droplets
    for (const pop of fx.pops) {
      // pops dispose geometry unconditionally on expiry — Meshes only, never Sprites
      expect(pop.mesh).toBeInstanceOf(THREE.Mesh);
      // Y always derives from scale, never from the y=-100 the killed group was parked at
      expect(pop.mesh.position.y).toBeGreaterThan(0);
      expect(pop.ttl).toBeLessThanOrEqual(0.45);
    }
    expect(fx.pops[0].mesh.position.y).toBeCloseTo(1.75); // core
    expect(fx.pops[1].mesh.position.y).toBeCloseTo(1.75); // shell
  });

  it("lands the camera juice with max-not-sum hitstop semantics", () => {
    const { ctx, fx } = fxHarness();

    fx.spawnHeadshotKillFx(new THREE.Vector3(0, 0, 0), { scale: 1 });
    expect(ctx.hitstopTimer).toBeCloseTo(0.05);
    expect(ctx.shakeTrauma).toBeCloseTo(0.12);

    ctx.hitstopTimer = 0.08; // a bigger stop already pending (e.g. boss) must win
    fx.spawnHeadshotKillFx(new THREE.Vector3(0, 0, 0), { scale: 1 });
    expect(ctx.hitstopTimer).toBeCloseTo(0.08);
  });

  it("suppresses shake/hitstop for bosses so their own death beat stays authoritative", () => {
    const { ctx, fx } = fxHarness();

    fx.spawnHeadshotKillFx(new THREE.Vector3(0, 0, 0), { scale: 2.4, boss: true });

    expect(fx.pops).toHaveLength(8);
    expect(fx.pops[0].mesh.position.y).toBeCloseTo(4.2); // 1.75 × boss deathScale 2.4
    expect(ctx.hitstopTimer).toBe(0);
    expect(ctx.shakeTrauma).toBe(0);
    expect(fx.lastHeadshotKill).toMatchObject({ boss: true, scale: 2.4 });
  });

  it("drains cleanly: pops expire in updateEffects and clearTransientFx keeps the seam monotonic", () => {
    const { scene, fx } = fxHarness();

    fx.spawnHeadshotKillFx(new THREE.Vector3(1, 0, 2), { scale: 1 });
    expect(fx.pops).toHaveLength(8);

    fx.updateEffects(1.0); // all beat TTLs ≤ 0.40s — one long tick drains everything
    expect(fx.pops).toHaveLength(0);
    expect(scene.remove).toHaveBeenCalledTimes(8);

    fx.spawnHeadshotKillFx(new THREE.Vector3(1, 0, 2), { scale: 1 });
    const seq = fx.headshotKillSeq;
    fx.clearTransientFx(); // sandbox "LAB CLEARED" path
    expect(fx.pops).toHaveLength(0);
    expect(fx.headshotKillSeq).toBe(seq); // monotonic test seam survives cleanup
  });
});
