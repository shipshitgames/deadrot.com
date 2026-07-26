import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SpawnConfig } from "../../src/game/entities/Enemy";

type EnemyModule = typeof import("../../src/game/entities/Enemy");
type EnemyInstance = InstanceType<EnemyModule["Enemy"]>;

// No spriteAssets mock: an enemy is geometry and a pose evaluator now, so its
// import graph never touches the texture lane and loads as-is under node.
let Enemy: EnemyModule["Enemy"];
const spawned: EnemyInstance[] = [];

beforeAll(async () => {
  Enemy = (await import("../../src/game/entities/Enemy")).Enemy;
});

afterEach(() => {
  for (const enemy of spawned.splice(0)) enemy.dispose();
});

function spawn(config: SpawnConfig = {}): EnemyInstance {
  const enemy = new Enemy();
  enemy.spawnAt(0, 0, { maxHealth: 100, archetype: "grunt", speed: 1, ...config });
  spawned.push(enemy);
  return enemy;
}

function knockX(enemy: EnemyInstance): number {
  return (enemy as unknown as { knockX: number }).knockX;
}

describe("enemy hit reactions", () => {
  it("makes headshots read stronger than body shots", () => {
    const body = spawn();
    const head = spawn();

    const bodyResult = body.takeDamage(10, false, 6, 1, 0);
    const headResult = head.takeDamage(10, true, 6, 1, 0);

    expect(bodyResult).toEqual({ died: false, headshot: false, blocked: false });
    expect(headResult).toEqual({ died: false, headshot: true, blocked: false });
    expect(body.hitFlash).toBeCloseTo(0.08);
    expect(head.hitFlash).toBeCloseTo(0.12);
    expect(head.staggerTimer).toBeGreaterThan(body.staggerTimer);
    expect(knockX(head)).toBeGreaterThan(knockX(body));
  });

  it("reduces stagger and knockback for tanks, elites, and bosses", () => {
    const grunt = spawn();
    const tank = spawn({ archetype: "tank" });
    const elite = spawn({ eliteAffix: "frenzied" });
    const boss = spawn({ isBoss: true });

    for (const enemy of [grunt, tank, elite, boss]) enemy.takeDamage(20, false, 6, 1, 0);

    expect(tank.staggerTimer).toBeLessThan(grunt.staggerTimer);
    expect(elite.staggerTimer).toBeLessThan(grunt.staggerTimer);
    expect(boss.staggerTimer).toBeLessThan(elite.staggerTimer);
    expect(knockX(tank)).toBeLessThan(knockX(grunt));
    expect(knockX(elite)).toBeLessThan(knockX(grunt));
    expect(knockX(boss)).toBeLessThan(knockX(elite));
  });

  it("keeps shield hits distinct from flesh reactions", () => {
    const boss = spawn({ isBoss: true });
    boss.shielded = true;

    const result = boss.takeDamage(40, true, 12, 1, 0);

    expect(result).toEqual({ died: false, headshot: true, blocked: true });
    expect(boss.health).toBe(100);
    expect(boss.hitFlash).toBe(0);
    expect(boss.staggerTimer).toBe(0);
    expect(knockX(boss)).toBe(0);
  });
});
