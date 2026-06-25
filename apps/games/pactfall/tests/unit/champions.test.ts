import { describe, expect, test } from "bun:test";
import {
  ABILITY_KEYS,
  CHAMPION_IDS,
  CHAMPIONS,
  championsForTeam,
  DEFAULT_ENEMY_CHAMPION_ID,
  DEFAULT_PLAYER_CHAMPION_ID,
} from "../../src/game/data/champions";
import { makeChampion } from "../../src/game/factory";
import { EntitySystem } from "../../src/game/systems/EntitySystem";

interface StubInput {
  hasKeyboardMove: boolean;
  move: { x: number; y: number };
  clickTarget: { x: number; y: number; z: number } | null;
}

interface StubGame {
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
    render: { add() {}, remove() {} },
    input: { hasKeyboardMove: false, move: { x: 0, y: 0 }, clickTarget: null } as StubInput,
    get buffed(): boolean {
      return false;
    },
    grantBuff() {},
    win() {},
    lose() {},
  } as unknown as StubGame;
  game.entities = new EntitySystem(game as unknown as never);
  return game;
}

describe("Pactfall champion roster", () => {
  test("ships multiple Pyre and Warden champions with complete role-kit data", () => {
    expect(championsForTeam("pyre").length).toBeGreaterThanOrEqual(2);
    expect(championsForTeam("warden").length).toBeGreaterThanOrEqual(2);

    for (const id of CHAMPION_IDS) {
      const champion = CHAMPIONS[id];
      expect(champion.name).toBeTruthy();
      expect(champion.role).toBeTruthy();
      expect(champion.faction).toBeTruthy();
      expect(champion.silhouette).toBeTruthy();
      expect(champion.resourceModel).toBeTruthy();
      expect(champion.basicAttack).toBeTruthy();
      expect(champion.progressionHooks.length).toBeGreaterThan(0);
      expect(champion.stats.maxHp).toBeGreaterThan(0);
      expect(champion.stats.moveSpeed).toBeGreaterThan(0);
      expect(champion.stats.attackDamage).toBeGreaterThan(0);
      expect(champion.stats.attackRange).toBeGreaterThan(0);
      for (const key of ABILITY_KEYS) {
        expect(champion.abilities[key].name).toBeTruthy();
        expect(champion.abilities[key].cooldown).toBeGreaterThan(0);
        expect(champion.abilities[key].manaCost).toBeGreaterThan(0);
      }
    }
  });

  test("team helpers expose the selected vertical-slice defaults", () => {
    expect(CHAMPIONS[DEFAULT_PLAYER_CHAMPION_ID].team).toBe("pyre");
    expect(CHAMPIONS[DEFAULT_ENEMY_CHAMPION_ID].team).toBe("warden");
    expect(championsForTeam("pyre").map((c) => c.id)).toContain(DEFAULT_PLAYER_CHAMPION_ID);
    expect(championsForTeam("warden").map((c) => c.id)).toContain(DEFAULT_ENEMY_CHAMPION_ID);
  });

  test("factory applies distinct stats, visuals, and ability kits by champion id", () => {
    const duelist = makeChampion("pyre-duelist");
    const cauterizer = makeChampion("pyre-cauterizer");
    const bastion = makeChampion("warden-bastion");

    expect(duelist.championName).toBe("Pyre Duelist");
    expect(cauterizer.championName).toBe("Pyre Cauterizer");
    expect(bastion.championName).toBe("Warden Bastion");
    expect(cauterizer.maxHp).not.toBe(duelist.maxHp);
    expect(cauterizer.attackRange).not.toBe(duelist.attackRange);
    expect(cauterizer.abilities!.q.name).not.toBe(duelist.abilities!.q.name);
    expect(bastion.maxHp).toBeGreaterThan(duelist.maxHp);
    expect(bastion.moveSpeed).toBeLessThan(duelist.moveSpeed);
  });

  test("EntitySystem selection spawns the chosen player and enemy champion ids", () => {
    const game = makeStubGame();
    game.entities.setChampion("pyre-cauterizer");
    game.entities.setEnemyChampion("warden-artillerist");
    game.entities.reset();

    expect(game.entities.champion.championId).toBe("pyre-cauterizer");
    expect(game.entities.enemyChampion.championId).toBe("warden-artillerist");
    expect(game.entities.champion.maxHp).toBe(CHAMPIONS["pyre-cauterizer"].stats.maxHp);
    expect(game.entities.enemyChampion.attackRange).toBe(CHAMPIONS["warden-artillerist"].stats.attackRange);
  });

  test("EntitySystem rejects selecting a champion from the wrong side", () => {
    const game = makeStubGame();
    expect(() => game.entities.setChampion("warden-bastion")).toThrow();
    expect(() => game.entities.setEnemyChampion("pyre-duelist")).toThrow();
  });
});
