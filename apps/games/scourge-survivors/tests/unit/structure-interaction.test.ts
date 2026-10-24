// Doors and windows are the only arena geometry the player can change at
// runtime, and StructureSystem owns all of it: the focus pick, the prompt, the
// swing, and the collider that comes and goes with it. These tests drive the
// system directly — no renderer, no arena — so the interaction contract is
// pinned independently of whichever map happens to author a building.
//
// The first test is a regression guard with teeth: findFocus() used to read
// ctx._fwd, a scratch vector WeaponSystem only refreshes when the player fires
// or melees. That left it at (0,0,0) for the whole opening stretch of a run, so
// every dot product came out 0 — below INTERACT_AIM_DOT — and no door was ever
// focusable until the first shot. The focus direction now comes off rig.facing,
// which is live every frame.

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GameContext } from "../../src/game/context";
import { StructureSystem } from "../../src/game/entities/StructureSystem";
import type { StructureLeaf } from "../../src/game/render/arenaGeometry";
import type { GameSystems } from "../../src/game/systems";

const sfxLog = vi.hoisted(() => [] as string[]);

vi.mock("../../src/audio/AudioEngine", () => ({
  audio: { sfx: (name: string) => sfxLog.push(name) },
}));

/** Openness at which the collider lifts — mirrors BLOCKING_OPENNESS. */
const BLOCKING_OPENNESS = 0.3;
/** Seconds for a full swing — mirrors LEAF_TRAVEL_TIME. */
const LEAF_TRAVEL_TIME = 0.42;

// A door in the south wall of a building whose interior lies at -Z: the clear
// cut is centred on (0, 1.05, 4) and the wall's outward normal points at +Z, so
// a player standing to the south approaches it head-on.
function doorLeaf(overrides: Partial<StructureLeaf> = {}): StructureLeaf {
  return {
    structureId: "hab",
    openingId: "south-door",
    kind: "door",
    side: "south",
    levelId: "ground",
    box: { x: 0, y: 1.05, z: 4, w: 1.1, h: 2.1, d: 0.12 },
    pivot: { x: -0.55, y: 0, z: 4 }, // hinge at the west edge of the cut
    arm: { x: 0.55, z: 0 },
    motion: "swing",
    openYaw: -Math.PI / 2, // free edge travels outward, away from the interior
    openSlide: { x: 0, z: 0 },
    state: "closed",
    glazed: false,
    center: { x: 0, y: 1.05, z: 4 },
    outward: { x: 0, z: 1 },
    clearWidth: 1.1,
    clearHeight: 2.1,
    ...overrides,
  };
}

function windowLeaf(overrides: Partial<StructureLeaf> = {}): StructureLeaf {
  return doorLeaf({
    openingId: "south-window",
    kind: "window",
    glazed: true,
    openYaw: 0,
    ...overrides,
  });
}

function harness(opts: { at?: [number, number, number]; yaw?: number } = {}) {
  const [x, y, z] = opts.at ?? [0, 1.7, 6]; // 2m south of the cut, eye height
  const ctx = {
    body: { position: new THREE.Vector3(x, y, z) },
    // Yaw only: rig.facing is the live orientation the focus pick reads.
    rig: { facing: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, opts.yaw ?? 0, 0, "YXZ")) },
    // Left at the origin on purpose. A fresh run has never fired a shot, so this
    // is exactly the value the old implementation was reading.
    _fwd: new THREE.Vector3(),
    obstacleBoxes: [] as THREE.Box3[],
    raycastTargets: [] as THREE.Object3D[],
    scene: new THREE.Scene(),
  } as unknown as GameContext;

  const toasts: string[] = [];
  const sparks: THREE.Vector3[] = [];
  const sys = {
    fx: { spawnImpactSpark: (at: THREE.Vector3) => sparks.push(at.clone()) },
    hud: { showToast: (text: string) => toasts.push(text) },
  } as unknown as GameSystems;

  return { ctx, sys, system: new StructureSystem(ctx, sys), toasts, sparks };
}

const doorMaterial = () => new THREE.MeshStandardMaterial();

describe("StructureSystem — interact focus", () => {
  it("focuses a door on the very first frame of a run, before any shot is fired", () => {
    const { ctx, system } = harness();
    system.build([doorLeaf()], doorMaterial());

    system.update(1 / 60);

    // The old ctx._fwd read would have scored every leaf at dot 0 here.
    expect(ctx._fwd.lengthSq()).toBe(0);
    expect(system.prompt()).toBe("OPEN DOOR");
  });

  it("names no input device in any of its prompts", () => {
    // The prompt reaches TouchPad's interact button verbatim, and a phone player
    // has no `E` to press — the key hint is the keyboard overlay's own affordance.
    const prompts: string[] = [];
    for (const leaf of [doorLeaf(), windowLeaf(), doorLeaf({ state: "locked" })]) {
      const { system } = harness();
      system.build([leaf], doorMaterial());
      system.update(1 / 60);
      prompts.push(system.prompt());
      system.interact(); // and again on the far side of the toggle
      system.update(1 / 60);
      prompts.push(system.prompt());
    }

    expect(prompts).toEqual(["OPEN DOOR", "CLOSE DOOR", "OPEN WINDOW", "CLOSE WINDOW", "DOOR LOCKED", "DOOR LOCKED"]);
    for (const prompt of prompts) expect(prompt).not.toMatch(/\[E\]|press|key|tap/i);
  });

  it("drops the focus when the player looks away from the door", () => {
    const { system } = harness({ yaw: Math.PI }); // facing +Z, door is behind
    system.build([doorLeaf()], doorMaterial());

    system.update(1 / 60);

    expect(system.prompt()).toBe("");
  });

  it("drops the focus when the door is out of arm's reach", () => {
    const { system } = harness({ at: [0, 1.7, 9] }); // 5m out, past INTERACT_RANGE
    system.build([doorLeaf()], doorMaterial());

    system.update(1 / 60);

    expect(system.prompt()).toBe("");
  });

  it("opens the nearer of two doors both within reach", () => {
    // Player at z=6 looking down -Z: the outer door at z=4.6 is 1.4m away, the
    // inner one at z=4 is 2.0m — both inside INTERACT_RANGE, so the pick has to
    // be decided on distance rather than on which leaf was built first.
    const { ctx, system } = harness({ at: [0, 1.7, 6] });
    const inner = doorLeaf({
      openingId: "inner-door",
      box: { x: 0, y: 1.05, z: 4, w: 1.1, h: 2.1, d: 0.12 },
      pivot: { x: -0.55, y: 0, z: 4 },
      center: { x: 0, y: 1.05, z: 4 },
    });
    const outer = doorLeaf({
      openingId: "outer-door",
      box: { x: 0, y: 1.05, z: 4.6, w: 1.1, h: 2.1, d: 0.12 },
      pivot: { x: -0.55, y: 0, z: 4.6 },
      center: { x: 0, y: 1.05, z: 4.6 },
    });
    system.build([inner, outer], doorMaterial()); // nearer one built second, on purpose

    system.update(1 / 60);
    system.interact();
    system.update(LEAF_TRAVEL_TIME);

    expect(sfxLog.at(-1)).toBe("doorOpen");
    expect(system.prompt()).toBe("CLOSE DOOR");
    // Exactly one leaf moved: the inner door is still shut and still blocking.
    expect(ctx.obstacleBoxes).toHaveLength(1);
    expect(ctx.obstacleBoxes[0].containsPoint(new THREE.Vector3(0, 1.05, 4))).toBe(true);
  });

  it("keeps a locked door focusable but refuses to open it", () => {
    const { system, toasts } = harness();
    system.build([doorLeaf({ state: "locked" })], doorMaterial());

    system.update(1 / 60);
    expect(system.prompt()).toBe("DOOR LOCKED");

    system.interact();
    system.update(LEAF_TRAVEL_TIME);

    expect(system.prompt()).toBe("DOOR LOCKED");
    expect(toasts).toEqual(["LOCKED"]);
    expect(sfxLog.at(-1)).toBe("doorLocked");
  });
});

describe("StructureSystem — the doorway actually opens", () => {
  it("blocks the cut while shut and clears it once the panel swings clear", () => {
    const { ctx, system } = harness();
    system.build([doorLeaf()], doorMaterial());
    system.update(1 / 60);

    // Shut: the collider covers the doorway, so the player cannot walk through.
    expect(ctx.obstacleBoxes).toHaveLength(1);
    expect(ctx.obstacleBoxes[0].containsPoint(new THREE.Vector3(0, 1.05, 4))).toBe(true);

    system.interact();
    system.update(LEAF_TRAVEL_TIME * BLOCKING_OPENNESS + 0.01); // just past the lift threshold

    // Open: nothing left in the player's push-out set, and the prompt has flipped.
    expect(ctx.obstacleBoxes).toHaveLength(0);
    expect(system.prompt()).toBe("CLOSE DOOR");
  });

  it("re-blocks the cut when the door is closed again", () => {
    const { ctx, system } = harness();
    system.build([doorLeaf()], doorMaterial());
    system.update(1 / 60);

    system.interact();
    system.update(LEAF_TRAVEL_TIME);
    expect(ctx.obstacleBoxes).toHaveLength(0);

    system.interact();
    system.update(LEAF_TRAVEL_TIME);

    expect(ctx.obstacleBoxes).toHaveLength(1);
    expect(ctx.obstacleBoxes[0].containsPoint(new THREE.Vector3(0, 1.05, 4))).toBe(true);
    expect(sfxLog.at(-1)).toBe("doorClose");
  });

  it("starts an authored open door wide, with the cut already clear", () => {
    const { ctx, system } = harness();
    system.build([doorLeaf({ state: "open" })], doorMaterial());

    system.update(1 / 60);

    expect(ctx.obstacleBoxes).toHaveLength(0);
    expect(system.prompt()).toBe("CLOSE DOOR");
  });
});

describe("StructureSystem — glass", () => {
  it("shatters a pane into a permanent hole and stops shooting at it", () => {
    const { ctx, system, sparks } = harness();
    system.build([windowLeaf()], doorMaterial());
    system.update(1 / 60);

    const pane = ctx.raycastTargets[0];
    expect(pane).toBeDefined();
    expect(ctx.obstacleBoxes).toHaveLength(1);

    expect(system.shatter(pane)).toBe(true);

    expect(ctx.obstacleBoxes).toHaveLength(0); // the player can climb through
    expect(ctx.raycastTargets).toHaveLength(0); // and shoot through
    expect(sparks).toHaveLength(1);
    expect(sfxLog.at(-1)).toBe("glassBreak");

    // Broken is permanent: no second shatter, no focus, and no prompt to re-shut it.
    expect(system.shatter(pane)).toBe(false);
    system.update(1 / 60);
    expect(system.prompt()).toBe("");
  });

  it("reports a non-pane hit as unbreakable so the hitscan treats it as wall", () => {
    const { ctx, system } = harness();
    system.build([doorLeaf()], doorMaterial());

    expect(system.shatter(ctx.raycastTargets[0])).toBe(false);
    expect(system.shatter(new THREE.Mesh())).toBe(false);
  });
});

describe("StructureSystem — teardown", () => {
  it("gives back every collider and raycast target on clear", () => {
    const { ctx, system } = harness();
    const stray = new THREE.Mesh();
    ctx.raycastTargets.push(stray);
    system.build([doorLeaf(), windowLeaf()], doorMaterial());

    expect(ctx.raycastTargets).toHaveLength(3);
    expect(ctx.obstacleBoxes).toHaveLength(2);

    system.clear();

    // Only the arena's own panels are withdrawn — anything else in the set stays.
    expect(ctx.raycastTargets).toEqual([stray]);
    expect(ctx.obstacleBoxes).toHaveLength(0);
    expect(ctx.scene.children).toHaveLength(0);
    expect(system.prompt()).toBe("");
  });

  it("is safe to clear before anything has been built", () => {
    const { system } = harness();
    expect(() => system.clear()).not.toThrow();
    expect(() => system.update(1 / 60)).not.toThrow();
  });
});
