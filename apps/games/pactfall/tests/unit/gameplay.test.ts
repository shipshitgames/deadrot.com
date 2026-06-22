import { describe, expect, test } from "bun:test";
import { COLORS, CONSTANTS, MARCH_DIR, type Team } from "../../src/game/constants";
import { makeBase, makeChampion, makeMinion, makeScourge } from "../../src/game/factory";
import { ASHGATE_MAP, totalActiveTowers } from "../../src/game/map";
import { EntitySystem } from "../../src/game/systems/EntitySystem";
import type { Entity } from "../../src/game/types";

// Down every tower belonging to `team` so the base behind it can be sieged
// (combat is gated on baseVulnerable). Tests that target a base directly use this.
function razeTowers(es: EntitySystem, team: Team): void {
  for (const t of es.towers) {
    if (t.team === team) {
      t.alive = false;
      t.hp = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Test harness: a minimal fake Game so we can drive the *real* EntitySystem
// (spawning, movement, combat, win/lose) without the WebGL RenderSystem or DOM.
// EntitySystem only touches game.render.{add,remove}, game.input, game.buffed,
// game.elapsed, game.grantBuff(), game.win(), game.lose().
// ---------------------------------------------------------------------------

interface StubInput {
  hasKeyboardMove: boolean;
  move: { x: number; y: number };
  clickTarget: { x: number; y: number; z: number } | null;
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
}

function makeStubGame(): StubGame {
  const game = {
    buffTime: 0,
    elapsed: 0,
    phase: "playing" as StubGame["phase"],
    render: { add() {}, remove() {} },
    input: { hasKeyboardMove: false, move: { x: 0, y: 0 }, clickTarget: null } as StubInput,
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
  return game;
}

// EntitySystem keeps all entities in a private `all` array. Reach in for assertions.
function allEntities(es: EntitySystem): Entity[] {
  return (es as unknown as { all: Entity[] }).all;
}
function minions(es: EntitySystem): Entity[] {
  return allEntities(es).filter((e) => e.kind === "minion");
}
function minionsOf(es: EntitySystem, team: Team): Entity[] {
  return minions(es).filter((e) => e.team === team);
}

// Advance the sim by `seconds`, broken into fixed sub-steps for stable physics.
function advance(game: StubGame, seconds: number, step = 1 / 60): void {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining);
    game.elapsed += dt;
    if (game.buffTime > 0) game.buffTime = Math.max(0, game.buffTime - dt);
    game.entities.update(dt);
    remaining -= dt;
  }
}

describe("pactfall constants — lane economy & objective tunables", () => {
  test("bases are the heaviest HP pools and dwarf champions and minions", () => {
    expect(CONSTANTS.base.maxHp).toBeGreaterThan(CONSTANTS.champion.maxHp);
    expect(CONSTANTS.champion.maxHp).toBeGreaterThan(CONSTANTS.minion.maxHp);
    expect(CONSTANTS.scourge.maxHp).toBeGreaterThan(CONSTANTS.champion.maxHp);
  });

  test("champions out-pace and out-range minions (carry > creep)", () => {
    expect(CONSTANTS.champion.moveSpeed).toBeGreaterThan(CONSTANTS.minion.moveSpeed);
    expect(CONSTANTS.champion.attackRange).toBeGreaterThan(CONSTANTS.minion.attackRange);
    expect(CONSTANTS.champion.attackDamage).toBeGreaterThan(CONSTANTS.minion.attackDamage);
    // Champions also fire faster (shorter cooldown) than creeps.
    expect(CONSTANTS.champion.attackCooldown).toBeLessThan(CONSTANTS.minion.attackCooldown);
  });

  test("bases sit on opposite ends of the lane, equidistant from center", () => {
    expect(CONSTANTS.base.friendlyZ).toBeLessThan(0);
    expect(CONSTANTS.base.enemyZ).toBeGreaterThan(0);
    expect(CONSTANTS.base.enemyZ).toBe(-CONSTANTS.base.friendlyZ);
  });

  test("scourge buff is a real upside: multiplier > 1 and finite duration", () => {
    expect(CONSTANTS.scourge.buffMultiplier).toBeGreaterThan(1);
    expect(CONSTANTS.scourge.buffDuration).toBeGreaterThan(0);
    expect(CONSTANTS.scourge.respawn).toBeGreaterThan(CONSTANTS.scourge.buffDuration);
  });

  test("march directions are opposite unit vectors per team", () => {
    expect(MARCH_DIR.pyre).toBe(1);
    expect(MARCH_DIR.warden).toBe(-1);
    expect(MARCH_DIR.pyre).toBe(-MARCH_DIR.warden);
  });

  test("delta clamp prevents tab-out teleports", () => {
    expect(CONSTANTS.maxDelta).toBeGreaterThan(0);
    expect(CONSTANTS.maxDelta).toBeLessThanOrEqual(1 / 24);
  });

  test("palette colors are valid 24-bit hex", () => {
    for (const value of Object.values(COLORS)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe("pactfall factory — entity stat wiring", () => {
  test("champion spawns at full HP with champion combat stats", () => {
    const c = makeChampion("pyre");
    expect(c.kind).toBe("champion");
    expect(c.team).toBe("pyre");
    expect(c.hp).toBe(CONSTANTS.champion.maxHp);
    expect(c.maxHp).toBe(CONSTANTS.champion.maxHp);
    expect(c.attackDamage).toBe(CONSTANTS.champion.attackDamage);
    expect(c.attackRange).toBe(CONSTANTS.champion.attackRange);
    expect(c.alive).toBe(true);
    expect(c.cooldown).toBe(0);
  });

  test("champion defaults to pyre but can be a warden", () => {
    expect(makeChampion().team).toBe("pyre");
    expect(makeChampion("warden").team).toBe("warden");
  });

  test("minion carries minion stats and the marching team", () => {
    const m = makeMinion("warden");
    expect(m.kind).toBe("minion");
    expect(m.team).toBe("warden");
    expect(m.hp).toBe(CONSTANTS.minion.maxHp);
    expect(m.attackDamage).toBe(CONSTANTS.minion.attackDamage);
  });

  test("scourge is a neutral, non-attacking objective", () => {
    const s = makeScourge();
    expect(s.kind).toBe("scourge");
    expect(s.team).toBe("neutral");
    expect(s.hp).toBe(CONSTANTS.scourge.maxHp);
    expect(s.attackDamage).toBe(0);
    expect(s.attackRange).toBe(0);
  });

  test("base is a high-HP, non-attacking structure", () => {
    const b = makeBase("pyre");
    expect(b.kind).toBe("base");
    expect(b.hp).toBe(CONSTANTS.base.maxHp);
    expect(b.attackDamage).toBe(0);
  });

  test("each factory call mints a fresh, independent entity", () => {
    const a = makeMinion("pyre");
    const b = makeMinion("pyre");
    a.hp = 5;
    expect(b.hp).toBe(CONSTANTS.minion.maxHp);
    expect(a).not.toBe(b);
  });
});

describe("pactfall EntitySystem — reset & lane layout", () => {
  test("reset deploys both champions, both bases, and the scourge at full HP", () => {
    const game = makeStubGame();
    game.entities.reset();

    expect(game.entities.champion.team).toBe("pyre");
    expect(game.entities.enemyChampion.team).toBe("warden");
    expect(game.entities.champion.hp).toBe(CONSTANTS.champion.maxHp);
    expect(game.entities.enemyChampion.hp).toBe(CONSTANTS.champion.maxHp);
    expect(game.entities.friendlyBase.hp).toBe(CONSTANTS.base.maxHp);
    expect(game.entities.enemyBase.hp).toBe(CONSTANTS.base.maxHp);
    expect(game.entities.scourge.alive).toBe(true);
  });

  test("bases deploy at their canonical lane ends", () => {
    const game = makeStubGame();
    game.entities.reset();
    expect(game.entities.friendlyBase.pos.z).toBe(CONSTANTS.base.friendlyZ);
    expect(game.entities.enemyBase.pos.z).toBe(CONSTANTS.base.enemyZ);
  });

  test("reset is idempotent — no leftover entities from a prior run", () => {
    const game = makeStubGame();
    game.entities.reset();
    advance(game, 6); // spawn a pile of minions
    expect(minions(game.entities).length).toBeGreaterThan(0);
    game.entities.reset();
    // Fresh layout: champions(2) + bases(2) + scourge(1) + the active tower
    // line, no minions yet.
    expect(minions(game.entities).length).toBe(0);
    expect(game.entities.towers.length).toBe(totalActiveTowers(ASHGATE_MAP));
    expect(allEntities(game.entities).length).toBe(5 + totalActiveTowers(ASHGATE_MAP));
  });
});

describe("pactfall EntitySystem — spawn cadence escalates the lane", () => {
  test("pyre spawns its first wave before the staggered warden wave", () => {
    const game = makeStubGame();
    game.entities.reset();
    // Pyre timer starts at 0, warden at 1.3 — step just past the first pyre spawn.
    advance(game, 0.1);
    expect(minionsOf(game.entities, "pyre").length).toBeGreaterThanOrEqual(1);
    expect(minionsOf(game.entities, "warden").length).toBe(0);
  });

  test("minion population grows monotonically over time (steady trickle)", () => {
    const game = makeStubGame();
    game.entities.reset();
    advance(game, CONSTANTS.minion.spawnInterval + 0.1);
    const early = minions(game.entities).length;
    advance(game, CONSTANTS.minion.spawnInterval * 3);
    const later = minions(game.entities).length;
    expect(later).toBeGreaterThan(early);
  });

  test("both teams contribute minions once past the warden stagger", () => {
    const game = makeStubGame();
    game.entities.reset();
    advance(game, CONSTANTS.minion.spawnInterval + 1.5);
    expect(minionsOf(game.entities, "pyre").length).toBeGreaterThan(0);
    expect(minionsOf(game.entities, "warden").length).toBeGreaterThan(0);
  });

  test("fresh minions deploy in front of their own base, not the enemy's", () => {
    const game = makeStubGame();
    game.entities.reset();
    advance(game, 0.05); // first pyre minion only, before it has moved far
    const pyreMinion = minionsOf(game.entities, "pyre")[0];
    expect(pyreMinion).toBeDefined();
    // Spawns near friendly (negative Z) end, well behind center.
    expect(pyreMinion.pos.z).toBeLessThan(0);
    expect(pyreMinion.pos.z).toBeGreaterThan(CONSTANTS.base.friendlyZ);
  });
});

describe("pactfall EntitySystem — champion movement & lane clamps", () => {
  test("keyboard forward input pushes the player champion down-lane (+Z)", () => {
    const game = makeStubGame();
    game.entities.reset();
    const z0 = game.entities.champion.pos.z;
    game.input.hasKeyboardMove = true;
    game.input.move = { x: 0, y: 1 };
    advance(game, 0.25);
    expect(game.entities.champion.pos.z).toBeGreaterThan(z0);
  });

  test("lateral movement is clamped to the lane half-width", () => {
    const game = makeStubGame();
    game.entities.reset();
    game.input.hasKeyboardMove = true;
    game.input.move = { x: 1, y: 0 }; // hard right, forever
    advance(game, 5);
    expect(Math.abs(game.entities.champion.pos.x)).toBeLessThanOrEqual(CONSTANTS.arena.laneClamp + 1e-6);
  });

  test("the player cannot retreat past retreatZ into its own base", () => {
    const game = makeStubGame();
    game.entities.reset();
    game.input.hasKeyboardMove = true;
    game.input.move = { x: 0, y: -1 }; // walk backward toward friendly base
    advance(game, 8);
    expect(game.entities.champion.pos.z).toBeGreaterThanOrEqual(CONSTANTS.champion.retreatZ - 1e-6);
  });

  test("forward speed respects the per-second move rate (no teleporting)", () => {
    const game = makeStubGame();
    game.entities.reset();
    const z0 = game.entities.champion.pos.z;
    game.input.hasKeyboardMove = true;
    game.input.move = { x: 0, y: 1 };
    const seconds = 0.5;
    advance(game, seconds);
    const traveled = game.entities.champion.pos.z - z0;
    // Can't exceed moveSpeed * time; should be close to it for a clear lane.
    expect(traveled).toBeLessThanOrEqual(CONSTANTS.champion.moveSpeed * seconds + 1e-6);
    expect(traveled).toBeGreaterThan(CONSTANTS.champion.moveSpeed * seconds * 0.5);
  });
});

describe("pactfall EntitySystem — combat, scourge buff & death", () => {
  test("slaying the scourge grants the champion damage buff and downs the blob", () => {
    const game = makeStubGame();
    game.entities.reset();
    expect(game.buffed).toBe(false);

    // Park the player on the scourge and zero its HP via the public sim:
    // a single update kills it through the kill() -> grantBuff() path.
    game.entities.scourge.hp = 1;
    game.entities.champion.pos.set(0, game.entities.champion.pos.y, 0);
    game.entities.champion.cooldown = 0;
    // Player auto-attacks the scourge once it's the only valid target in range.
    advance(game, CONSTANTS.champion.attackCooldown * 2);

    expect(game.entities.scourge.alive).toBe(false);
    expect(game.buffed).toBe(true);
    expect(game.buffTime).toBeGreaterThan(0);
  });

  test("buffed champion deals multiplied damage to a base", () => {
    const game = makeStubGame();
    game.entities.reset();
    // The enemy base is only vulnerable once the Warden tower line is down.
    razeTowers(game.entities, "warden");

    // Push the player up against the enemy base, clear lane, no buff.
    const base = game.entities.enemyBase;
    game.entities.champion.pos.set(0, game.entities.champion.pos.y, base.pos.z - 1);
    game.entities.champion.cooldown = 0;
    const baseHpBefore = base.hp;
    advance(game, 1 / 60);
    const unbuffedDealt = baseHpBefore - base.hp;
    expect(unbuffedDealt).toBeGreaterThan(0);

    // Now reset the base, grant the buff, and re-measure a single hit.
    base.hp = base.maxHp;
    game.entities.champion.cooldown = 0;
    game.buffTime = CONSTANTS.scourge.buffDuration;
    game.entities.champion.pos.set(0, game.entities.champion.pos.y, base.pos.z - 1);
    const buffedBefore = base.hp;
    advance(game, 1 / 60);
    const buffedDealt = buffedBefore - base.hp;

    expect(buffedDealt).toBeCloseTo(unbuffedDealt * CONSTANTS.scourge.buffMultiplier, 1);
  });

  test("the scourge stays down for its respawn timer then comes back at full HP", () => {
    const game = makeStubGame();
    game.entities.reset();
    game.entities.scourge.alive = false;
    game.entities.scourge.hp = 0;
    // Force the system's internal respawn counter via the kill path.
    (game.entities as unknown as { scourgeRespawn: number }).scourgeRespawn = CONSTANTS.scourge.respawn;

    advance(game, CONSTANTS.scourge.respawn * 0.5);
    expect(game.entities.scourge.alive).toBe(false);

    advance(game, CONSTANTS.scourge.respawn * 0.6);
    expect(game.entities.scourge.alive).toBe(true);
    expect(game.entities.scourge.hp).toBe(CONSTANTS.scourge.maxHp);
  });

  test("a slain champion goes down and redeploys at full HP after the delay", () => {
    const game = makeStubGame();
    game.entities.reset();
    const player = game.entities.champion;

    // Kill via damage through a single base-less tick: zero HP, mark dead path.
    player.hp = 0;
    (game.entities as unknown as { championDown: Record<Team, number> }).championDown.pyre =
      CONSTANTS.champion.respawnDelay;
    player.alive = false;

    advance(game, CONSTANTS.champion.respawnDelay * 0.5);
    expect(game.entities.champion.alive).toBe(false);

    advance(game, CONSTANTS.champion.respawnDelay * 0.6);
    expect(game.entities.champion.alive).toBe(true);
    expect(game.entities.champion.hp).toBe(CONSTANTS.champion.maxHp);
  });
});

describe("pactfall EntitySystem — win / lose state machine", () => {
  test("destroying the enemy (warden) base wins the match", () => {
    const game = makeStubGame();
    game.entities.reset();
    game.entities.enemyBase.hp = 0;
    game.entities.enemyBase.alive = false;
    advance(game, 1 / 60);
    expect(game.phase).toBe("won");
  });

  test("losing the friendly (pyre) base loses the match", () => {
    const game = makeStubGame();
    game.entities.reset();
    game.entities.friendlyBase.hp = 0;
    game.entities.friendlyBase.alive = false;
    advance(game, 1 / 60);
    expect(game.phase).toBe("lost");
  });

  test("the match stays in play while both bases stand", () => {
    const game = makeStubGame();
    game.entities.reset();
    advance(game, 2);
    expect(game.entities.friendlyBase.alive).toBe(true);
    expect(game.entities.enemyBase.alive).toBe(true);
    expect(game.phase).toBe("playing");
  });

  test("a resolved match is sticky — a second outcome cannot overwrite it", () => {
    const game = makeStubGame();
    game.entities.reset();
    game.entities.enemyBase.alive = false; // win first
    advance(game, 1 / 60);
    expect(game.phase).toBe("won");
    game.entities.friendlyBase.alive = false; // would-be loss
    advance(game, 1 / 60);
    expect(game.phase).toBe("won"); // win() / lose() only act while "playing"
  });
});
