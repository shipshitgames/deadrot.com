// System-harness tests for the Toll (#278): the named reaper that arrives at the
// 10:00 goal of a Survivors run. Pure schedule/identity helpers are covered in
// reaper.test.ts — this file drives the REAL SurvivorsSystem and PveDirectorSystem
// with hand-rolled plain-object fakes (the mission-system.test.ts harness pattern).
//
// Two module mocks neutralize browser-only module-scope work so the systems can
// load under node: spriteAssets eagerly builds textures via THREE.TextureLoader
// (needs `document`), and the audio singleton is replaced with a recording stub.

import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  REAPER_ATTACK_INTERVAL,
  REAPER_ATTACK_RANGE,
  REAPER_HEALTH,
  REAPER_PROJECTILE_DAMAGE,
  REAPER_RESIST_TOTAL_TIERS,
  REAPER_RESIST_VIGOR_TIERS,
  REAPER_RESISTED_TOUCH_DAMAGE,
  REAPER_SCALE,
  REAPER_SCORE,
  REAPER_SPEED,
  REAPER_TOUCH_DAMAGE,
  REAPER_WARNING_LEAD,
} from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import { getMap } from "../../src/game/data/maps";
import { reaperForMap } from "../../src/game/data/reaper";
import { SURVIVOR_RUN_CHAPTERS, SURVIVOR_RUN_GOAL_TIME } from "../../src/game/data/survivors";
import type { Enemy } from "../../src/game/entities/Enemy";
import { PveDirectorSystem } from "../../src/game/modes/PveDirectorSystem";
import { SurvivorsSystem } from "../../src/game/modes/SurvivorsSystem";
import type { GameSystems } from "../../src/game/systems";

const sfxLog = vi.hoisted(() => [] as string[]);

vi.mock("../../src/audio/AudioEngine", () => ({
  audio: { sfx: (name: string) => sfxLog.push(name) },
}));

vi.mock("../../src/game/spriteAssets", async () => {
  const { Texture } = await import("three");
  const tex = () => new Texture();
  const views = () => ({ front: tex(), side: tex(), back: tex() });
  const frameViews = () => ({ front: [tex()], side: [tex()], back: [tex()] });
  const states = <T>(make: () => T) => ({ move: make(), attack: make(), death: make() });
  const kinds = <T>(make: () => T) => ({ melee: make(), ranged: make(), flying: make(), boss: make() });
  return {
    PROJECTILE_SPRITE_TEXTURES: { enemy: tex(), boss: tex(), bolt: tex(), orb: tex() },
    XP_BLOOD_TEXTURE: tex(),
    XP_BLOOD_SCALE: [0.62, 0.62] as [number, number],
    ENEMY_SPRITE_TEXTURES: kinds(views),
    ENEMY_SPRITE_ANIMATION_TEXTURES: kinds(() => states(frameViews)),
    ENEMY_SPRITE_ANIMATION_META: kinds(() => states(() => ({ fps: 8, loop: true, frameCount: 1 }))),
    ENEMY_SPRITE_SCALES: kinds(() => ({ front: [1, 1], side: [1, 1], back: [1, 1] })),
  };
});

type SpawnConfig = Record<string, unknown>;

interface FakeEnemy {
  alive: boolean;
  kill: () => void;
  spawnAt: (x: number, z: number, config: SpawnConfig) => void;
}

function survivorsHarness(shopTiers: Record<string, number> = {}) {
  const calls: string[] = [];
  const spawns: { x: number; z: number; config: SpawnConfig }[] = [];

  const makeEnemy = (): FakeEnemy => {
    const enemy: FakeEnemy = {
      alive: false,
      kill: () => {
        enemy.alive = false;
        calls.push("enemy:kill");
      },
      spawnAt: (x, z, config) => {
        enemy.alive = true;
        spawns.push({ x, z, config });
        calls.push("enemy:spawnAt");
      },
    };
    return enemy;
  };

  const pve = {
    bossActive: false,
    bossEnemy: null as FakeEnemy | null,
    bossMaxHealth: 0,
    bossName: null as string | null,
    getFreeEnemy: () => {
      calls.push("pve:getFreeEnemy");
      const enemy = makeEnemy();
      ctx.enemies.push(enemy);
      return enemy;
    },
  };

  const ctx = {
    status: "playing",
    survivors: true,
    sandbox: false,
    campaign: false,
    survivorClassId: "ranger",
    // Park the clock in the final chapter so updateStructuredRun exercises the
    // reaper beat instead of routing into advanceChapter's arena rebuild.
    survivorChapter: SURVIVOR_RUN_CHAPTERS.length - 1,
    survivorTotalChapters: SURVIVOR_RUN_CHAPTERS.length,
    survivorGoalTime: SURVIVOR_RUN_GOAL_TIME,
    activeWeapon: "pistol",
    health: 100,
    maxHealthValue: 100,
    ammo: 0,
    reserve: 0,
    reloading: false,
    statRegen: 0,
    statShield: 0,
    statShieldMax: 0,
    statShieldRegen: 0,
    statMagnet: 0,
    damageGraceTimer: 0,
    aliveCount: Number.MAX_SAFE_INTEGER, // sit at the swarm cap: no steady fodder spawns
    enemies: [] as FakeEnemy[],
    body: { position: { x: 0, y: 0, z: 0 } },
    bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60, containsXZ: () => true },
    scene: { add: () => {}, remove: () => {} },
    currentMap: getMap("ashgate"),
  };

  const sys = {
    pve,
    hud: {
      emit: () => calls.push("hud:emit"),
      announce: (text: string) => calls.push(`hud:announce:${text}`),
      showToast: (text: string) => calls.push(`hud:toast:${text}`),
    },
    fx: {
      addShake: () => calls.push("fx:shake"),
      hitstop: () => calls.push("fx:hitstop"),
      spawnEnemyDeath: () => calls.push("fx:spawnEnemyDeath"),
    },
    gameOver: { gameOver: (outcome: "win" | "dead") => calls.push(`gameover:${outcome}`) },
    projectiles: { clearProjectiles: () => calls.push("projectiles:clear") },
    arena: {
      buildArena: () => calls.push("arena:build"),
      placeAtSpawn: () => calls.push("arena:spawn"),
    },
  };

  const system = new SurvivorsSystem(ctx as unknown as GameContext, sys as unknown as GameSystems);
  system.init(); // orbitGroup must exist before updateOrbit/rebuildOrbit run
  system.shopTiers = shopTiers;
  // Park the side-channel spawners so updates only exercise the structured-run beat.
  system.eliteTimer = 1e9;
  system.swellTimer = 1e9;
  return { calls, spawns, ctx, pve, system };
}

/** Drive the run clock across the goal time (warning latch pre-armed). */
function crossGoal(h: ReturnType<typeof survivorsHarness>) {
  h.system.reaperWarned = true;
  h.system.survClock = SURVIVOR_RUN_GOAL_TIME - 0.5;
  h.system.updateSurvivors(1);
}

function directorHarness() {
  const calls: string[] = [];
  const survivors = {
    reaper: null as Enemy | null,
    isReaper(enemy: Enemy) {
      return this.reaper !== null && enemy === this.reaper;
    },
    enemyXp: new WeakMap<Enemy, number>(),
    dropXpGem: () => calls.push("survivors:dropXpGem"),
    onEliteKilled: () => calls.push("survivors:onEliteKilled"),
    onEnemyKilled: () => calls.push("survivors:onEnemyKilled"),
    takeEliteSplitAllowance: () => 0,
  };
  const ctx = {
    survivors: true,
    sandbox: false,
    campaign: false,
    status: "playing",
    activeWeapon: "pistol",
    kills: 0,
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
      spawnEnemyDeath: () => calls.push("fx:spawnEnemyDeath"),
    },
    hud: {
      killSeq: 0,
      announce: (text: string) => calls.push(`hud:announce:${text}`),
      showToast: (text: string) => calls.push(`hud:toast:${text}`),
    },
    gameOver: { gameOver: (outcome: "win" | "dead") => calls.push(`gameover:${outcome}`) },
    pickups: { spawnPickup: () => calls.push("pickups:spawn"), maybeDropPickup: () => calls.push("pickups:maybe") },
    mission: { onBossDefeated: () => calls.push("mission:onBossDefeated") },
  };
  const director = new PveDirectorSystem(ctx as unknown as GameContext, sys as unknown as GameSystems);
  return { calls, ctx, survivors, director };
}

/** A dying isBoss enemy as PveDirectorSystem.onEnemyDeath sees it. */
function fakeDeadBoss(): Enemy {
  return {
    isBoss: true,
    alive: false,
    position: new THREE.Vector3(3, 0, -4),
    group: { scale: { x: REAPER_SCALE } },
    radius: 1,
    maxHealth: REAPER_HEALTH,
    speed: 2,
    splitCount: 0,
    archetype: "tank",
    eliteAffix: null,
    deathFx: () => ({ kind: "boss", view: "front", flip: false }),
  } as unknown as Enemy;
}

beforeEach(() => {
  sfxLog.length = 0;
});

describe("reaper arrival (the toll, #278)", () => {
  it("spawns the lore-named reaper exactly once when the clock crosses the goal", () => {
    const { calls, spawns, ctx, pve, system } = survivorsHarness();
    const identity = reaperForMap("ashgate");
    system.reaperWarned = true; // warning beat is covered separately
    system.survClock = SURVIVOR_RUN_GOAL_TIME - 0.5;

    system.updateSurvivors(0.4); // 599.9 — the toll is not yet due
    expect(spawns).toHaveLength(0);
    expect(pve.bossActive).toBe(false);

    system.updateSurvivors(0.2); // 600.1 — it falls due
    expect(calls.filter((c) => c === "pve:getFreeEnemy")).toHaveLength(1);
    expect(spawns).toHaveLength(1);
    expect(spawns[0].config).toMatchObject({
      isBoss: true,
      archetype: "tank",
      scale: REAPER_SCALE,
      maxHealth: REAPER_HEALTH,
      speed: REAPER_SPEED,
      color: identity.tint,
      attackDamage: REAPER_TOUCH_DAMAGE,
      attackInterval: REAPER_ATTACK_INTERVAL,
      attackRange: REAPER_ATTACK_RANGE,
      projectileDamage: REAPER_PROJECTILE_DAMAGE,
    });

    // arrival presentation: lore name on the banner, stakes toast, layered sfx
    expect(calls).toContain(`hud:announce:${identity.name.toUpperCase()}`);
    expect(calls).toContain("hud:toast:THE BREACH TOLLS");
    expect(sfxLog).toContain("breach");
    expect(sfxLog).toContain("boss");

    // boss bar state for the HUD
    expect(pve.bossActive).toBe(true);
    expect(pve.bossEnemy).toBe(ctx.enemies[0]);
    expect(pve.bossMaxHealth).toBe(REAPER_HEALTH);
    expect(pve.bossName).toBe(identity.name);
    expect(system.isReaper(ctx.enemies[0] as unknown as Enemy)).toBe(true);

    // the spawned latch holds: later frames never double-spawn
    system.updateSurvivors(1);
    system.updateSurvivors(30);
    expect(spawns).toHaveLength(1);
    expect(calls.filter((c) => c === "pve:getFreeEnemy")).toHaveLength(1);
  });

  it("never grants the old BREACH SEALED timed win at the goal — the reaper arrives instead", () => {
    const { calls, spawns, system } = survivorsHarness();
    system.survClock = SURVIVOR_RUN_GOAL_TIME - 0.5;
    system.updateSurvivors(1); // crosses the goal (warning frame)
    system.updateSurvivors(45); // long past the goal (arrival frame)

    expect(calls.some((c) => c.startsWith("gameover:"))).toBe(false);
    expect(calls).not.toContain("hud:toast:BREACH SEALED");
    expect(spawns).toHaveLength(1); // the goal now delivers the toll, not the win
  });
});

describe("reaper warning beat", () => {
  it("fires the dread toast + sfx once inside the lead window, before arrival, never after", () => {
    const { calls, spawns, system } = survivorsHarness();
    const warned = () => calls.filter((c) => c === "hud:toast:SOMETHING VAST APPROACHES").length;
    system.survClock = SURVIVOR_RUN_GOAL_TIME - REAPER_WARNING_LEAD - 0.3;

    system.updateSurvivors(0.2); // 0.1s short of the window
    expect(warned()).toBe(0);
    expect(sfxLog).not.toContain("lowhealth");

    system.updateSurvivors(0.2); // inside the window
    expect(warned()).toBe(1);
    expect(sfxLog).toContain("lowhealth");
    expect(spawns).toHaveLength(0); // warning strictly precedes arrival

    system.updateSurvivors(1); // still inside the window — the latch holds
    expect(warned()).toBe(1);

    system.survClock = SURVIVOR_RUN_GOAL_TIME - 0.1;
    system.updateSurvivors(0.2); // arrival frame
    expect(spawns).toHaveLength(1);
    expect(warned()).toBe(1); // and never again after arrival
    system.updateSurvivors(5);
    expect(warned()).toBe(1);
  });
});

describe("reaper victory (PveDirectorSystem.onEnemyDeath)", () => {
  it("seals the breach on reaper death: clears the boss bar, scores, wins the run", () => {
    const { calls, ctx, survivors, director } = directorHarness();
    const reaper = fakeDeadBoss();
    survivors.reaper = reaper;
    director.bossActive = true;
    director.bossEnemy = reaper;
    director.bossName = "Lane Tyrant";

    director.onEnemyDeath(reaper, false);

    expect(ctx.score).toBe(REAPER_SCORE);
    expect(director.bossActive).toBe(false);
    expect(director.bossEnemy).toBeNull();
    expect(director.bossName).toBeNull();
    expect(survivors.reaper).toBeNull();
    expect(calls).toContain("hud:toast:BREACH SEALED");
    expect(calls).toContain("gameover:win");
    // the victory IS the reward: the elite drop/XP economy is skipped entirely
    expect(calls).not.toContain("survivors:dropXpGem");
    expect(calls).not.toContain("survivors:onEliteKilled");
  });

  it("clears the bar but suppresses the victory beat if the run already ended this frame", () => {
    const { calls, ctx, survivors, director } = directorHarness();
    const reaper = fakeDeadBoss();
    survivors.reaper = reaper;
    director.bossActive = true;
    director.bossEnemy = reaper;
    ctx.status = "gameover"; // the player died first

    director.onEnemyDeath(reaper, false);

    expect(director.bossActive).toBe(false);
    expect(survivors.reaper).toBeNull();
    expect(calls).not.toContain("gameover:win");
    expect(calls).not.toContain("hud:toast:BREACH SEALED");
  });

  it("does not end the run for a non-reaper elite that also carries isBoss", () => {
    const { calls, ctx, survivors, director } = directorHarness();
    const elite = fakeDeadBoss();
    survivors.reaper = null; // identity is the director-held reference, never the flag

    director.onEnemyDeath(elite, false);

    expect(calls.some((c) => c.startsWith("gameover:"))).toBe(false);
    expect(calls).not.toContain("hud:toast:BREACH SEALED");
    expect(ctx.score).toBe(250); // the ordinary Survivors elite bounty
    // the elite economy still pays out
    expect(calls).toContain("survivors:dropXpGem");
    expect(calls).toContain("survivors:onEliteKilled");
    expect(calls).toContain("survivors:onEnemyKilled");
  });
});

describe("run reset", () => {
  it("initSurvivorsRun clears the reaper latches and the boss bar across restarts", () => {
    const h = survivorsHarness();
    crossGoal(h);
    expect(h.pve.bossActive).toBe(true);
    expect(h.system.reaper).not.toBeNull();
    expect(h.system.reaperWarned).toBe(true);

    h.system.initSurvivorsRun();

    expect(h.system.reaper).toBeNull();
    expect(h.system.reaperWarned).toBe(false);
    expect(h.system.survClock).toBe(0);
    expect(h.pve.bossActive).toBe(false);
    expect(h.pve.bossEnemy).toBeNull();
    expect(h.pve.bossName).toBeNull();
    expect(h.ctx.enemies.every((enemy) => !enemy.alive)).toBe(true); // the old toll is dead
  });
});

describe("reaper touch damage at spawn (permanent shop gate)", () => {
  it("ships the guaranteed one-shot with an empty shop", () => {
    const h = survivorsHarness({});
    crossGoal(h);

    expect(h.spawns[0].config.attackDamage).toBe(REAPER_TOUCH_DAMAGE);
    expect(h.calls).toContain("hud:toast:THE BREACH TOLLS");
    expect(h.calls).not.toContain("hud:toast:YOUR SCARS HOLD — IT CAN BLEED");
  });

  it("ships the survivable strike once permanent progression meets the resist threshold", () => {
    const h = survivorsHarness({
      vigor: REAPER_RESIST_VIGOR_TIERS,
      might: REAPER_RESIST_TOTAL_TIERS - REAPER_RESIST_VIGOR_TIERS,
    });
    crossGoal(h);

    expect(h.spawns[0].config.attackDamage).toBe(REAPER_RESISTED_TOUCH_DAMAGE);
    expect(h.calls).toContain("hud:toast:YOUR SCARS HOLD — IT CAN BLEED");
    expect(h.calls).not.toContain("hud:toast:THE BREACH TOLLS");
  });
});
