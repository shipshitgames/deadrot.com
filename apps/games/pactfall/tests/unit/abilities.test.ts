import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/game/constants";
import { makeChampion } from "../../src/game/factory";
import {
  ABILITY_KEYS,
  AbilityCaster,
  type AbilityKey,
  AbilitySystem,
  firstLineHit,
  lineHitDistance,
  regenMana,
  slowedSpeed,
  specsFromConstants,
} from "../../src/game/systems/abilities";
import { EntitySystem } from "../../src/game/systems/EntitySystem";

// ---------------------------------------------------------------------------
// Test harness: the same minimal fake Game gameplay.test.ts uses, extended with
// the input surface AbilitySystem consumes (ability queue + cursor aim). Drives
// the *real* EntitySystem + AbilitySystem without WebGL or DOM.
// ---------------------------------------------------------------------------

interface StubInput {
  hasKeyboardMove: boolean;
  move: { x: number; y: number };
  clickTarget: { x: number; y: number; z: number } | null;
  queue: AbilityKey[];
  takeAbilities: () => AbilityKey[];
  aimPoint: () => null;
}

interface StubGame {
  buffTime: number;
  elapsed: number;
  phase: "title" | "playing" | "won" | "lost";
  render: { add: (o: unknown) => void; remove: (o: unknown) => void };
  input: StubInput;
  readonly buffed: boolean;
  grantBuff: () => void;
  win: () => void;
  lose: () => void;
  entities: EntitySystem;
  abilities: AbilitySystem;
}

function makeStubGame(): StubGame {
  const input: StubInput = {
    hasKeyboardMove: false,
    move: { x: 0, y: 0 },
    clickTarget: null,
    queue: [],
    takeAbilities() {
      const out = this.queue.slice();
      this.queue.length = 0;
      return out;
    },
    aimPoint: () => null, // no cursor in tests — casts fall back to lane facing
  };
  const game = {
    buffTime: 0,
    elapsed: 0,
    phase: "playing" as StubGame["phase"],
    render: { add() {}, remove() {} },
    input,
    get buffed(): boolean {
      return this.buffTime > 0;
    },
    grantBuff(): void {
      this.buffTime = CONSTANTS.scourge.buffDuration;
    },
    win(): void {
      if (this.phase === "playing") this.phase = "won";
    },
    lose(): void {
      if (this.phase === "playing") this.phase = "lost";
    },
  } as unknown as StubGame;
  game.entities = new EntitySystem(game as unknown as never);
  game.abilities = new AbilitySystem(game as unknown as never);
  game.entities.reset();
  game.abilities.reset();
  return game;
}

// Advance ONLY the ability system (no auto-attacks / spawns polluting HP math).
function advanceAbilities(game: StubGame, seconds: number, step = 1 / 60): void {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining);
    game.abilities.update(dt);
    remaining -= dt;
  }
}

describe("pactfall ability constants — costs, cooldowns & damage tables", () => {
  test("every ability has a positive cooldown and an affordable mana cost", () => {
    for (const key of ABILITY_KEYS) {
      const spec = CONSTANTS.abilities[key];
      expect(spec.cooldown).toBeGreaterThan(0);
      expect(spec.manaCost).toBeGreaterThan(0);
      expect(spec.manaCost).toBeLessThanOrEqual(CONSTANTS.champion.maxMana);
    }
  });

  test("Q clearly out-damages a single auto-attack (nuke, not a poke)", () => {
    expect(CONSTANTS.abilities.q.damage).toBeGreaterThan(CONSTANTS.champion.attackDamage * 2);
  });

  test("W's full tick damage beats an auto but each tick stays light", () => {
    const w = CONSTANTS.abilities.w;
    const ticks = Math.floor(w.duration / w.tickInterval);
    expect(w.tickDamage).toBeLessThan(CONSTANTS.champion.attackDamage);
    expect(w.tickDamage * ticks).toBeGreaterThan(CONSTANTS.champion.attackDamage);
  });

  test("W slow is a real slow: factor strictly between 0 and 1", () => {
    expect(CONSTANTS.abilities.w.slowFactor).toBeGreaterThan(0);
    expect(CONSTANTS.abilities.w.slowFactor).toBeLessThan(1);
    expect(CONSTANTS.abilities.w.duration).toBeGreaterThan(0);
  });

  test("Q outranges autos so landing it is a pick, and E actually moves you", () => {
    expect(CONSTANTS.abilities.q.range).toBeGreaterThan(CONSTANTS.champion.attackRange);
    expect(CONSTANTS.abilities.e.distance).toBeGreaterThan(0);
  });

  test("mana regen can pay a full Q rotation within its cooldown", () => {
    expect(CONSTANTS.champion.manaRegen * CONSTANTS.abilities.q.cooldown).toBeGreaterThanOrEqual(
      CONSTANTS.abilities.q.manaCost,
    );
  });
});

describe("AbilityCaster — cooldown & mana math", () => {
  test("a fresh caster is ready on all three slots", () => {
    const caster = new AbilityCaster(specsFromConstants());
    for (const key of ABILITY_KEYS) expect(caster.ready(key)).toBe(true);
  });

  test("cast pays the mana cost and starts the cooldown", () => {
    const caster = new AbilityCaster(specsFromConstants());
    const remaining = caster.cast("q", 100);
    expect(remaining).toBe(100 - CONSTANTS.abilities.q.manaCost);
    expect(caster.cooldowns.q).toBe(CONSTANTS.abilities.q.cooldown);
    expect(caster.ready("q")).toBe(false);
  });

  test("a cooling slot refuses to cast and keeps its cooldown", () => {
    const caster = new AbilityCaster(specsFromConstants());
    caster.cast("w", 100);
    const cd = caster.cooldowns.w;
    expect(caster.cast("w", 100)).toBeNull();
    expect(caster.cooldowns.w).toBe(cd);
  });

  test("insufficient mana refuses the cast; exact mana is enough", () => {
    const caster = new AbilityCaster(specsFromConstants());
    const cost = CONSTANTS.abilities.e.manaCost;
    expect(caster.cast("e", cost - 0.01)).toBeNull();
    expect(caster.ready("e")).toBe(true); // a refused cast must not burn the slot
    expect(caster.cast("e", cost)).toBe(0);
  });

  test("tick counts cooldowns down and clamps at zero", () => {
    const caster = new AbilityCaster(specsFromConstants());
    caster.cast("q", 100);
    caster.tick(CONSTANTS.abilities.q.cooldown / 2);
    expect(caster.cooldowns.q).toBeCloseTo(CONSTANTS.abilities.q.cooldown / 2, 5);
    caster.tick(CONSTANTS.abilities.q.cooldown * 10);
    expect(caster.cooldowns.q).toBe(0);
    expect(caster.ready("q")).toBe(true);
  });

  test("reset clears every cooldown", () => {
    const caster = new AbilityCaster(specsFromConstants());
    for (const key of ABILITY_KEYS) caster.cast(key, 100);
    caster.reset();
    for (const key of ABILITY_KEYS) expect(caster.ready(key)).toBe(true);
  });
});

describe("pure helpers — mana regen, slow, line skillshot math", () => {
  test("regenMana adds regen * dt and clamps at the pool cap", () => {
    expect(regenMana(50, 100, 10, 1)).toBe(60);
    expect(regenMana(99, 100, 10, 1)).toBe(100);
  });

  test("slowedSpeed applies the factor only while the timer runs", () => {
    expect(slowedSpeed(10, 0.5, 0.6)).toBeCloseTo(6, 5);
    expect(slowedSpeed(10, 0, 0.6)).toBe(10);
  });

  test("lineHitDistance: dead-ahead target is struck at its distance", () => {
    const d = lineHitDistance({ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 8 }, 0.5, 16, 1.6);
    expect(d).toBe(8);
  });

  test("lineHitDistance misses targets behind, beside, or beyond the line", () => {
    const origin = { x: 0, z: 0 };
    const dir = { x: 0, z: 1 };
    expect(lineHitDistance(origin, dir, { x: 0, z: -4 }, 0.5, 16, 1.6)).toBeNull(); // behind
    expect(lineHitDistance(origin, dir, { x: 4, z: 8 }, 0.5, 16, 1.6)).toBeNull(); // beside
    expect(lineHitDistance(origin, dir, { x: 0, z: 30 }, 0.5, 16, 1.6)).toBeNull(); // beyond
  });

  test("lineHitDistance forgives near-misses by the target's radius", () => {
    // Lateral 1.5 > half-width 0.8, but radius 1.0 closes the gap.
    expect(lineHitDistance({ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 1.5, z: 8 }, 1.0, 16, 1.6)).not.toBeNull();
  });

  test("firstLineHit picks the nearest body — minions block the lance", () => {
    const near = { pos: { x: 0, z: 5 }, radius: 0.5, name: "minion" };
    const far = { pos: { x: 0, z: 10 }, radius: 0.8, name: "champion" };
    const off = { pos: { x: 5, z: 7 }, radius: 0.5, name: "bystander" };
    const hit = firstLineHit({ x: 0, z: 0 }, { x: 0, z: 1 }, [far, off, near], 16, 1.6);
    expect(hit).not.toBeNull();
    expect(hit?.target.name).toBe("minion");
    expect(hit?.distance).toBe(5);
  });
});

describe("AbilitySystem — casts through the live sim", () => {
  test("champions deploy with a full mana pool wired from constants", () => {
    const c = makeChampion("pyre");
    expect(c.mana).toBe(CONSTANTS.champion.maxMana);
    expect(c.maxMana).toBe(CONSTANTS.champion.maxMana);
    expect(c.slowTimer).toBe(0);
  });

  test("mana regenerates over time and caps at the pool", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999; // keep the AI quiet
    game.entities.champion.mana = 0;
    advanceAbilities(game, 1);
    expect(game.entities.champion.mana).toBeCloseTo(CONSTANTS.champion.manaRegen, 1);
    advanceAbilities(game, 60);
    expect(game.entities.champion.mana).toBe(CONSTANTS.champion.maxMana);
  });

  test("Q strikes the first enemy down the lane, pays mana, starts the cooldown", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const foe = game.entities.enemyChampion;
    foe.pos.set(0, foe.pos.y, player.pos.z + 8); // 8 units dead ahead (+Z facing)

    game.input.queue.push("q");
    game.abilities.update(1 / 60);

    expect(foe.hp).toBe(foe.maxHp - CONSTANTS.abilities.q.damage);
    expect(player.mana).toBe(CONSTANTS.champion.maxMana - CONSTANTS.abilities.q.manaCost);
    expect(game.abilities.player.cooldowns.q).toBeCloseTo(CONSTANTS.abilities.q.cooldown, 5);
    expect(game.abilities.events.playerCasts).toEqual(["q"]);
  });

  test("an aimed-past Q whiffs — the lance is miss-able", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const foe = game.entities.enemyChampion;
    foe.pos.set(5, foe.pos.y, player.pos.z + 8); // well off the +Z line

    game.input.queue.push("q");
    game.abilities.update(1 / 60);

    expect(foe.hp).toBe(foe.maxHp);
    // The cast still costs mana — whiffing is the punishment.
    expect(player.mana).toBe(CONSTANTS.champion.maxMana - CONSTANTS.abilities.q.manaCost);
  });

  test("casting without mana dryfires: no damage, no cooldown burned", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const foe = game.entities.enemyChampion;
    foe.pos.set(0, foe.pos.y, player.pos.z + 8);
    player.mana = 0;

    game.input.queue.push("q");
    game.abilities.update(1 / 60);

    expect(foe.hp).toBe(foe.maxHp);
    expect(game.abilities.events.dryfire).toBe(true);
    expect(game.abilities.events.playerCasts).toEqual([]);
    expect(game.abilities.player.ready("q")).toBe(true);
  });

  test("W brands the ground: enemies inside are slowed and ticked", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const foe = game.entities.enemyChampion;
    foe.pos.set(2, foe.pos.y, player.pos.z + 2);

    game.abilities.castW(player, { x: foe.pos.x, z: foe.pos.z });
    advanceAbilities(game, 1);

    expect(foe.slowTimer).toBeGreaterThan(0);
    const w = CONSTANTS.abilities.w;
    const lost = foe.maxHp - foe.hp;
    expect(lost).toBeGreaterThanOrEqual(w.tickDamage); // at least one tick landed
    expect(lost).toBeLessThanOrEqual(w.tickDamage * 3); // but it's chip, not a nuke
    expect(lost % w.tickDamage).toBeCloseTo(0, 5); // damage arrives in whole ticks
  });

  test("a queued W with no cursor (tap-to-cast path) brands the champion's own feet", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const foe = game.entities.enemyChampion;
    // Park the foe on the champion: if the cursor-less cast falls back to the
    // caster's feet (how HUD tap-casts resolve), the foe sits inside the zone.
    foe.pos.set(player.pos.x, foe.pos.y, player.pos.z);

    game.input.queue.push("w"); // aimPoint() is null in the stub — the touch case
    advanceAbilities(game, 1);

    expect(game.abilities.events.playerCasts).toEqual(["w"]);
    expect(game.abilities.player.ready("w")).toBe(false); // the cast really went out
    expect(foe.slowTimer).toBeGreaterThan(0);
    expect(foe.hp).toBeLessThan(foe.maxHp); // ticks land at the fallback point
  });

  test("the brand zone expires after its duration and stops ticking", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const foe = game.entities.enemyChampion;
    foe.pos.set(2, foe.pos.y, player.pos.z + 2);

    game.abilities.castW(player, { x: foe.pos.x, z: foe.pos.z });
    advanceAbilities(game, CONSTANTS.abilities.w.duration + 0.2);
    const afterExpiry = foe.hp;
    advanceAbilities(game, 1);
    expect(foe.hp).toBe(afterExpiry);
  });

  test("E vaults the champion forward and pays its mana cost", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    const z0 = player.pos.z;

    game.input.queue.push("e");
    game.abilities.update(1 / 60);

    expect(player.pos.z).toBeCloseTo(z0 + CONSTANTS.abilities.e.distance, 5);
    expect(player.mana).toBe(CONSTANTS.champion.maxMana - CONSTANTS.abilities.e.manaCost);
    expect(game.abilities.player.cooldowns.e).toBeCloseTo(CONSTANTS.abilities.e.cooldown, 5);
  });

  test("E respects the lane clamps — no vaulting out of the arena", () => {
    const game = makeStubGame();
    game.abilities.enemy.cooldowns.q = 999;
    const player = game.entities.champion;
    player.pos.x = CONSTANTS.arena.laneClamp - 0.5;
    game.input.hasKeyboardMove = true;
    game.input.move = { x: 1, y: 0 }; // dash hard right

    game.input.queue.push("e");
    game.abilities.update(1 / 60);

    expect(player.pos.x).toBeLessThanOrEqual(CONSTANTS.arena.laneClamp + 1e-6);
  });
});

describe("AbilitySystem — Warden AI lance is telegraphed and dodge-able", () => {
  test("the AI casts Q on cooldown when the player is in range, after a windup", () => {
    const game = makeStubGame();
    const player = game.entities.champion;
    player.pos.set(0, player.pos.y, game.entities.enemyChampion.pos.z - 10); // inside Q range

    game.abilities.update(1 / 60); // AI locks in the telegraph
    expect(game.abilities.enemy.cooldowns.q).toBeGreaterThan(0);
    expect(game.abilities.events.enemyCasts).toEqual(["q"]);
    expect(player.hp).toBe(player.maxHp); // nothing lands during the windup

    advanceAbilities(game, CONSTANTS.ai.qWindup + 0.1);
    expect(player.hp).toBe(player.maxHp - CONSTANTS.abilities.q.damage);
  });

  test("side-stepping the telegraph dodges the whole nuke", () => {
    const game = makeStubGame();
    const player = game.entities.champion;
    player.pos.set(0, player.pos.y, game.entities.enemyChampion.pos.z - 10);

    game.abilities.update(1 / 60); // telegraph locked at the old position
    player.pos.x += 5; // step out of the corridor
    advanceAbilities(game, CONSTANTS.ai.qWindup + 0.1);

    expect(player.hp).toBe(player.maxHp);
  });

  test("the AI holds fire when the player is out of range", () => {
    const game = makeStubGame();
    // Default deploy positions are a full lane apart — beyond Q range.
    game.abilities.update(1 / 60);
    expect(game.abilities.events.enemyCasts).toEqual([]);
    expect(game.abilities.enemy.ready("q")).toBe(true);
  });
});
