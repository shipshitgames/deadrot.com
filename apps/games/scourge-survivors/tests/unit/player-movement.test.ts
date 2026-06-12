import { makeMoveIntent } from "@shipshitgames/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GameContext } from "../../src/game/context";
import { PlayerSystem } from "../../src/game/entities/PlayerSystem";
import type { GameSystems } from "../../src/game/systems";

describe("player movement feel", () => {
  it("adds a short acceleration pulse when sprint starts", () => {
    const walking = makeMovementHarness();
    walking.ctx.move.forward = true;
    walking.system.updatePlayerMovement(1 / 60);

    const sprinting = makeMovementHarness();
    sprinting.ctx.move.forward = true;
    sprinting.ctx.wantsSprint = true;
    sprinting.system.updatePlayerMovement(1 / 60);

    expect(Math.abs(sprinting.ctx.velocity.z)).toBeGreaterThan(Math.abs(walking.ctx.velocity.z));
    expect(sprinting.ctx.sprintStartBoostTimer).toBeGreaterThan(0);
    expect(sprinting.ctx.wasSprinting).toBe(true);
  });

  it("brakes faster once movement input is released", () => {
    const coasting = makeMovementHarness();
    coasting.ctx.velocity.z = -8;
    coasting.ctx.move.forward = true;
    coasting.system.updatePlayerMovement(1 / 60);

    const braking = makeMovementHarness();
    braking.ctx.velocity.z = -8;
    braking.system.updatePlayerMovement(1 / 60);

    expect(Math.abs(braking.ctx.velocity.z)).toBeLessThan(Math.abs(coasting.ctx.velocity.z));
  });
});

function makeMovementHarness() {
  const position = new THREE.Vector3(0, 1.8, 0);
  const ctx = {
    _dir: new THREE.Vector3(),
    activeWeapon: "pistol",
    adsT: 0,
    body: { position },
    damageBoostTimer: 0,
    move: makeMoveIntent(),
    obstacleBoxes: [],
    rig: { movePlanar: () => {} },
    stanceHeight: 1.8,
    statMoveMul: 1,
    velocity: new THREE.Vector3(),
    wantsCrouch: false,
    wantsSprint: false,
    wasSprinting: false,
    sprintStartBoostTimer: 0,
  } as unknown as GameContext;

  return {
    ctx,
    system: new PlayerSystem(ctx, {} as GameSystems),
  };
}
