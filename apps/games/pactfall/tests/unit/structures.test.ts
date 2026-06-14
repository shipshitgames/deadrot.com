import { describe, expect, test } from "bun:test";
import { CONSTANTS, type Team } from "../../src/game/constants";
import { ASHGATE_MAP, activeTowersFor, primaryLane, towerZ } from "../../src/game/map";
import { EntitySystem } from "../../src/game/systems/EntitySystem";
import type { Entity } from "../../src/game/types";

// ---------------------------------------------------------------------------
// Tower structures + base gating. Drives the *real* EntitySystem through the
// same minimal fake Game the gameplay suite uses (no WebGL / DOM).
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

function towersOf(es: EntitySystem, team: Team): Entity[] {
  return es.towers.filter((t) => t.team === team);
}

function razeTowers(es: EntitySystem, team: Team): void {
  for (const t of es.towers) {
    if (t.team === team) {
      t.alive = false;
      t.hp = 0;
    }
  }
}

// Park the (idle) player champion at a spot and clear its cooldown so the next
// tick resolves an auto-attack. Movement holds because there is no input.
function parkChampion(game: StubGame, x: number, z: number): void {
  const c = game.entities.champion;
  c.pos.set(x, c.pos.y, z);
  c.cooldown = 0;
}

// Clear the lane of everything but towers and the player champion so a tower
// interaction is the *only* thing that can resolve (the Warden champion also
// deploys mid-lane, and the Scourge sits at center — both would steal targets).
function isolateTowers(game: StubGame): void {
  game.entities.enemyChampion.alive = false;
  game.entities.enemyChampion.mesh.visible = false;
  game.entities.scourge.alive = false;
  game.entities.scourge.mesh.visible = false;
}

describe("pactfall structures — the tower line deploys from the map", () => {
  test("reset spawns the active lanes' towers, split evenly, all standing", () => {
    const game = makeStubGame();
    game.entities.reset();

    expect(game.entities.towers.length).toBeGreaterThan(0);
    expect(game.entities.towers.every((t) => t.kind === "tower" && t.alive)).toBe(true);
    expect(towersOf(game.entities, "pyre").length).toBe(activeTowersFor(ASHGATE_MAP, "pyre"));
    expect(towersOf(game.entities, "warden").length).toBe(activeTowersFor(ASHGATE_MAP, "warden"));
  });

  test("towers stand on the live lane between center and their owner's base", () => {
    const game = makeStubGame();
    game.entities.reset();
    const mid = primaryLane(ASHGATE_MAP);

    for (const team of ["pyre", "warden"] as Team[]) {
      const expected = mid.towers[team].map((def) => towerZ(ASHGATE_MAP, team, def)).sort((a, b) => a - b);
      const actual = towersOf(game.entities, team)
        .map((t) => t.pos.z)
        .sort((a, b) => a - b);
      expect(actual).toEqual(expected);
      // Pyre towers sit on the friendly (−Z) half; Warden towers on the +Z half.
      for (const t of towersOf(game.entities, team)) {
        expect(t.pos.x).toBe(mid.xOffset);
        if (team === "pyre") expect(t.pos.z).toBeLessThan(0);
        else expect(t.pos.z).toBeGreaterThan(0);
      }
    }
  });

  test("each tower is tougher than a champion but softer than a base", () => {
    const game = makeStubGame();
    game.entities.reset();
    const tower = game.entities.towers[0];
    expect(tower.maxHp).toBeGreaterThan(CONSTANTS.champion.maxHp);
    expect(tower.maxHp).toBeLessThan(CONSTANTS.base.maxHp);
  });
});

describe("pactfall structures — standing count & base vulnerability", () => {
  test("a fresh base is shielded by a full tower line", () => {
    const game = makeStubGame();
    game.entities.reset();
    expect(game.entities.structuresStanding("pyre")).toBe(activeTowersFor(ASHGATE_MAP, "pyre"));
    expect(game.entities.structuresStanding("warden")).toBe(activeTowersFor(ASHGATE_MAP, "warden"));
    expect(game.entities.baseVulnerable("pyre")).toBe(false);
    expect(game.entities.baseVulnerable("warden")).toBe(false);
  });

  test("razing a team's towers exposes only that team's base", () => {
    const game = makeStubGame();
    game.entities.reset();
    razeTowers(game.entities, "warden");
    expect(game.entities.structuresStanding("warden")).toBe(0);
    expect(game.entities.baseVulnerable("warden")).toBe(true);
    // The Pyre side is untouched.
    expect(game.entities.baseVulnerable("pyre")).toBe(false);
  });
});

describe("pactfall structures — towers gate the base", () => {
  test("the enemy base takes no champion fire while its towers stand", () => {
    const game = makeStubGame();
    game.entities.reset();
    const base = game.entities.enemyBase;

    // Stand on the base with a clear shot, but the Warden tower line is intact.
    // No tower is in range here (the inner tower sits a base-radius beyond reach),
    // so the gate is the *only* thing that can keep the base safe. Keep the window
    // under the Warden wave's firstSpawnDelay (1.3s) so no enemy minion wanders in
    // to steal the champion's fire and mask the gate.
    parkChampion(game, base.pos.x, base.pos.z - 1);
    const before = base.hp;
    advance(game, CONSTANTS.champion.attackCooldown * 2);
    expect(base.hp).toBe(before); // gated — not a scratch
    expect(game.phase).toBe("playing");
  });

  test("once the towers fall the base can be sieged", () => {
    const game = makeStubGame();
    game.entities.reset();
    const base = game.entities.enemyBase;

    razeTowers(game.entities, "warden");
    parkChampion(game, base.pos.x, base.pos.z - 1);
    const before = base.hp;
    advance(game, CONSTANTS.champion.attackCooldown * 3);
    expect(base.hp).toBeLessThan(before);
  });

  test("a champion auto-attacks the nearest enemy tower before the base", () => {
    const game = makeStubGame();
    game.entities.reset();
    // Park beside the Warden inner tower with nothing else to shoot.
    isolateTowers(game);
    const innerTower = towersOf(game.entities, "warden").reduce((a, b) =>
      Math.abs(a.pos.z - CONSTANTS.base.enemyZ) < Math.abs(b.pos.z - CONSTANTS.base.enemyZ) ? a : b,
    );
    parkChampion(game, innerTower.pos.x, innerTower.pos.z - 2);
    advance(game, CONSTANTS.champion.attackCooldown * 2);

    // The champion engages the tower rather than marching past it. (Base gating
    // in isolation is proven by "the enemy base takes no champion fire while its
    // towers stand" above — a standing tower both outranks and shields the base,
    // so asserting base HP here would not distinguish priority from the gate.)
    expect(innerTower.hp).toBeLessThan(innerTower.maxHp);
  });
});

describe("pactfall structures — towers fight and fall", () => {
  test("a standing tower punishes a diving champion", () => {
    const game = makeStubGame();
    game.entities.reset();
    isolateTowers(game); // the tower is the only thing that can hurt the diver

    const tower = towersOf(game.entities, "warden").reduce((a, b) =>
      Math.abs(a.pos.z - CONSTANTS.base.enemyZ) < Math.abs(b.pos.z - CONSTANTS.base.enemyZ) ? a : b,
    );
    parkChampion(game, tower.pos.x, tower.pos.z - 2);
    const hpBefore = game.entities.champion.hp;
    advance(game, CONSTANTS.tower.attackCooldown * 2);
    expect(game.entities.champion.hp).toBeLessThan(hpBefore);
  });

  test("a pyre minion batters a warden tower it has marched up to", () => {
    const game = makeStubGame();
    game.entities.reset();
    advance(game, 0.05); // mint the first pyre minion
    const minion = (game.entities as unknown as { all: Entity[] }).all.find(
      (e) => e.kind === "minion" && e.team === "pyre",
    );
    expect(minion).toBeDefined();
    if (!minion) return;

    const tower = towersOf(game.entities, "warden").reduce((a, b) => (a.pos.z < b.pos.z ? a : b)); // outer
    minion.pos.set(tower.pos.x, minion.pos.y, tower.pos.z - 1);
    minion.cooldown = 0;
    const towerBefore = tower.hp;
    advance(game, 1 / 60);
    expect(tower.hp).toBeLessThan(towerBefore);
  });

  test("a toppled tower stays down — it is never culled and never respawns", () => {
    const game = makeStubGame();
    game.entities.reset();
    const count = game.entities.towers.length;
    const tower = towersOf(game.entities, "warden")[0];

    tower.hp = 1;
    game.entities.damage(tower, 999, { dealer: game.entities.champion });
    expect(tower.alive).toBe(false);
    expect(tower.mesh.visible).toBe(false);

    // Long enough that a respawning entity (scourge/champion) would be back.
    advance(game, CONSTANTS.scourge.respawn + 2);
    expect(tower.alive).toBe(false);
    expect(game.entities.towers.length).toBe(count); // array intact for the count
  });

  test("destroying a tower emits a tower kill event for the juice layer", () => {
    const game = makeStubGame();
    game.entities.reset();
    const tower = towersOf(game.entities, "warden")[0];
    tower.hp = 1;
    game.entities.damage(tower, 999, { dealer: game.entities.champion });
    expect(game.entities.events.kills.some((k) => k.kind === "tower")).toBe(true);
  });
});
