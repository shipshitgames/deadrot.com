// The first-person weapon stopped being a sprite and became a procedural rig,
// but the only coverage that followed it was e2e text: sandbox.spec.ts reads the
// weapon label and the ammo counter, neither of which would change if the model
// came back as an empty group or if the reload animation stopped reaching it.
//
// Two things are pinned here, in the two places they can break:
//
//   1. buildWeaponViewModel authors a real silhouette per weapon and per tier,
//      with every transform seam the animator reaches for actually present, the
//      barrel pointing down -Z, and every GPU resource it allocated tracked so
//      a weapon swap can release it.
//
//   2. WeaponSystem.applyPose lands the evaluator's slide and magazine travel on
//      that rig's bones. This is the seam Codex called out as unverified: the
//      pose maths had tests, the rig had tests, and nothing proved the pose ever
//      arrived. A silent regression here — a rest vector captured from the wrong
//      model, a reload block short-circuited — leaves a gun that fires and
//      reloads on paper while the magazine never moves on screen.
//
// Both halves drive real objects: real three.js scene graph, real WeaponSystem,
// no renderer. Only AudioEngine is mocked, because updateLanding cues a thud.

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { PLAYER_HEIGHT, RELOAD_TIME, WEAPON_ORDER, WEAPONS, type WeaponId } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import {
  MAIN_WEAPON_VISUAL_TIERS,
  type MainWeaponVisualTier,
  mainWeaponTierIndex,
} from "../../src/game/data/survivors";
import { mainWeaponTierViewScale } from "../../src/game/data/weaponView";
import { buildWeaponViewModel, disposeWeaponViewModel } from "../../src/game/render/models/weaponModels";
import type { GameSystems } from "../../src/game/systems";

vi.mock("../../src/audio/AudioEngine", () => ({ audio: { sfx: () => {} } }));

/**
 * The authored silhouette of each gun, transcribed from its builder.
 *
 * Kept as data rather than as per-weapon tests so a new weapon that forgets a
 * seam fails immediately instead of quietly going uncovered.
 */
const SILHOUETTES: Record<
  WeaponId,
  {
    /** Where the flash hangs — negative, because the rig points down -Z. */
    muzzleZ: number;
    magazineRest: [number, number, number];
    /** Reciprocating part's first child, i.e. what the slide travel moves. */
    boltName: string;
    sightName: string;
    /** A pump gun's forend *is* the slide; everything else has its own. */
    foregripIsSlide: boolean;
    hasStock: boolean;
  }
> = {
  pistol: {
    muzzleZ: -0.49,
    magazineRest: [0, -0.255, 0.028],
    boltName: "reciprocating-slide",
    sightName: "iron-sight",
    foregripIsSlide: false,
    hasStock: false,
  },
  smg: {
    muzzleZ: -0.84,
    magazineRest: [0, -0.25, -0.13],
    boltName: "charging-bolt",
    sightName: "reflex-sight",
    foregripIsSlide: false,
    hasStock: true,
  },
  shotgun: {
    muzzleZ: -0.98,
    magazineRest: [0, -0.14, -0.08],
    boltName: "pump-bolt",
    sightName: "front-bead",
    foregripIsSlide: true,
    hasStock: true,
  },
  cannon: {
    muzzleZ: -1.16,
    magazineRest: [0, -0.23, -0.12],
    boltName: "recoil-breech",
    sightName: "range-sight",
    foregripIsSlide: false,
    hasStock: true,
  },
  sniper: {
    muzzleZ: -1.48,
    magazineRest: [0, -0.2, -0.13],
    boltName: "bolt-carrier",
    sightName: "sight",
    foregripIsSlide: false,
    hasStock: true,
  },
};

/** Hardware each tier step is expected to bolt on, cumulatively. */
const TIER_HARDWARE: string[][] = [
  [],
  ["tier-rail"],
  ["tier-compensator", "tier-side-rail"],
  ["extended-magazine", "tier-lower-rail"],
  ["evolved-core-left", "evolved-core-right", "evolved-muzzle-fin"],
];

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

describe("buildWeaponViewModel — every gun comes back as a real silhouette", () => {
  for (const id of WEAPON_ORDER) {
    const shape = SILHOUETTES[id];

    it(`${id}: exposes every seam the animator drives`, () => {
      const vm = buildWeaponViewModel(id, "base");

      // The four bones applyPose and the FX code reach for by name.
      expect(vm.body.parent).toBe(vm.group);
      expect(vm.slide.parent).toBe(vm.group);
      expect(vm.magazine.parent).toBe(vm.group);
      expect(vm.muzzle.parent).toBe(vm.body);
      expect(vm.muzzle.name).toBe("muzzle");
      expect(vm.eject.name).toBe("eject");

      // The brass port is a hole in the frame. Riding the slide would fling
      // casings out of position for the length of every reload.
      expect(vm.eject.parent).toBe(vm.body);

      // Something actually reciprocates, and it is not an empty group.
      expect(vm.slide.children.length).toBeGreaterThan(0);
      expect(vm.slide.getObjectByName(shape.boltName)).toBeDefined();

      expect(vm.sight).toBeDefined();
      expect(vm.sight?.name).toBe(shape.sightName);
      if (shape.hasStock) expect(vm.stock).toBeDefined();
      else expect(vm.stock).toBeUndefined();
      if (shape.foregripIsSlide) expect(vm.foregrip).toBe(vm.slide);
      else if (vm.foregrip) expect(vm.foregrip).not.toBe(vm.slide);

      expect(meshesOf(vm.group).length).toBeGreaterThan(4);
      disposeWeaponViewModel(vm);
    });

    it(`${id}: aims down -Z with its own magazine placement`, () => {
      const vm = buildWeaponViewModel(id, "base");

      // Camera-local metres, barrel down -Z. A positive muzzle Z would fire the
      // tracer out of the back of the player's head.
      expect(vm.muzzle.position.z).toBeCloseTo(shape.muzzleZ, 5);
      expect(vm.muzzle.position.z).toBeLessThan(0);

      const [mx, my, mz] = shape.magazineRest;
      expect(vm.magazine.position.x).toBeCloseTo(mx, 5);
      expect(vm.magazine.position.y).toBeCloseTo(my, 5);
      expect(vm.magazine.position.z).toBeCloseTo(mz, 5);
      // Below the receiver on every gun: reload travel drops it out of the well.
      expect(vm.magazine.position.y).toBeLessThan(0);

      disposeWeaponViewModel(vm);
    });

    it(`${id}: labels itself and scales with the tier`, () => {
      for (const tier of MAIN_WEAPON_VISUAL_TIERS) {
        const vm = buildWeaponViewModel(id, tier);

        expect(vm.group.name).toBe(`weapon-view-${id}-${tier}`);
        expect(vm.group.userData.weaponId).toBe(id);
        expect(vm.group.userData.visualTier).toBe(tier);
        expect(vm.group.userData.accent).toBe(WEAPONS[id].accent);
        expect(vm.group.scale.x).toBeCloseTo(mainWeaponTierViewScale(tier), 6);
        expect(vm.group.scale.y).toBeCloseTo(mainWeaponTierViewScale(tier), 6);
        expect(vm.group.scale.z).toBeCloseTo(mainWeaponTierViewScale(tier), 6);

        disposeWeaponViewModel(vm);
      }
    });

    it(`${id}: grows real hardware as the tier climbs`, () => {
      let previousMeshCount = 0;

      for (const tier of MAIN_WEAPON_VISUAL_TIERS) {
        const vm = buildWeaponViewModel(id, tier);
        const index = mainWeaponTierIndex(tier);

        // Everything earned so far is still bolted on…
        for (let step = 0; step <= index; step += 1) {
          for (const part of TIER_HARDWARE[step]) {
            expect(vm.group.getObjectByName(part), `${tier} is missing ${part}`).toBeDefined();
          }
        }
        // …and nothing from a tier this gun has not reached yet.
        for (let step = index + 1; step < TIER_HARDWARE.length; step += 1) {
          for (const part of TIER_HARDWARE[step]) {
            expect(vm.group.getObjectByName(part), `${tier} leaked ${part}`).toBeUndefined();
          }
        }

        // A visible upgrade, not just a scale bump: each step adds geometry.
        const meshCount = meshesOf(vm.group).length;
        expect(meshCount).toBeGreaterThan(previousMeshCount);
        previousMeshCount = meshCount;

        // The accent glow brightens with the tier — this is what
        // updateAccentMaterials overrides during a berserk window.
        expect(vm.accentMaterials.length).toBeGreaterThan(0);
        for (const material of vm.accentMaterials) {
          expect(vm.materials).toContain(material);
          expect(material.emissive.getHex()).not.toBe(0x000000);
        }

        disposeWeaponViewModel(vm);
      }
    });

    it(`${id}: tracks every resource it allocated, and releases them all`, () => {
      const vm = buildWeaponViewModel(id, "evolved");
      const holder = new THREE.Group();
      holder.add(vm.group);

      // Nothing untracked: a mesh whose geometry or material is missing from the
      // arrays would survive disposeWeaponViewModel and leak on every swap.
      const meshes = meshesOf(vm.group);
      expect(meshes.length).toBe(vm.geometries.length);
      for (const mesh of meshes) {
        expect(vm.geometries).toContain(mesh.geometry);
        expect(vm.materials).toContain(mesh.material as THREE.Material);
        // The view model draws over the world rather than into it.
        expect(mesh.renderOrder).toBe(20);
        expect((mesh.material as THREE.MeshStandardMaterial).depthTest).toBe(false);
      }

      const disposed: string[] = [];
      for (const geometry of vm.geometries) geometry.addEventListener("dispose", () => disposed.push("geometry"));
      for (const material of vm.materials) material.addEventListener("dispose", () => disposed.push("material"));

      disposeWeaponViewModel(vm);

      expect(disposed.filter((k) => k === "geometry")).toHaveLength(vm.geometries.length);
      expect(disposed.filter((k) => k === "material")).toHaveLength(vm.materials.length);
      expect(vm.group.parent).toBeNull();
      expect(holder.children).toHaveLength(0);
    });
  }

  it("hands out independent instances so the dual-wield pair never shares a bone", () => {
    // applyWeaponModel builds the off-hand from the same call. If the builder
    // memoised, moving one magazine would move both.
    const left = buildWeaponViewModel("pistol", "base");
    const right = buildWeaponViewModel("pistol", "base");

    expect(right.group).not.toBe(left.group);
    expect(right.magazine).not.toBe(left.magazine);
    expect(right.slide).not.toBe(left.slide);
    for (const material of right.materials) expect(left.materials).not.toContain(material);

    left.magazine.position.y -= 1;
    expect(right.magazine.position.y).not.toBeCloseTo(left.magazine.position.y, 3);

    disposeWeaponViewModel(left);
    disposeWeaponViewModel(right);
  });
});

describe("WeaponSystem — the reload animation reaches the rig", () => {
  it("drops the magazine out of the well mid-reload", async () => {
    // p = 0.45 sits inside the fully-extracted plateau, so the offset is the
    // evaluator's exact peak rather than a point on a ramp.
    const { weapon, model, magazineRest } = await rigHarness({
      reloading: true,
      reloadTimer: RELOAD_TIME * 0.55,
    });

    weapon.updateWeapon(1 / 60);

    expect(model().magazine.position.x).toBeCloseTo(magazineRest().x + 0.035, 5);
    expect(model().magazine.position.y).toBeCloseTo(magazineRest().y - 0.34, 5);
    expect(model().magazine.position.z).toBeCloseTo(magazineRest().z + 0.08, 5);
    // Well clear of the receiver, not a sub-millimetre twitch.
    expect(magazineRest().y - model().magazine.position.y).toBeGreaterThan(0.3);
  });

  it("runs the bolt forward on the last third of the reload", async () => {
    // p = 0.80 is the crest of the bolt-release sine.
    const { weapon, model, slideRest, magazineRest } = await rigHarness({
      reloading: true,
      reloadTimer: RELOAD_TIME * 0.2,
    });

    weapon.updateWeapon(1 / 60);

    expect(model().slide.position.z).toBeCloseTo(slideRest().z + 0.065, 5);
    // Travel is along the bore only — a bolt that drifts sideways reads as a
    // broken rig, not as a chambering round.
    expect(model().slide.position.x).toBeCloseTo(slideRest().x, 6);
    expect(model().slide.position.y).toBeCloseTo(slideRest().y, 6);
    // By the time the bolt goes home the fresh magazine is already seated.
    expect(model().magazine.position.toArray()).toEqual(magazineRest().toArray());
  });

  it("leaves both bones at rest on an idle frame", async () => {
    const { weapon, model, slideRest, magazineRest } = await rigHarness({});

    weapon.updateWeapon(1 / 60);

    expect(model().slide.position.toArray()).toEqual(slideRest().toArray());
    expect(model().magazine.position.toArray()).toEqual(magazineRest().toArray());
  });

  it("tilts the whole gun out of the aim line while reloading", async () => {
    // The bones move relative to the gun; the gun itself has to come down and
    // back, or the reload plays inside the crosshair.
    const idle = await rigHarness({});
    const reloading = await rigHarness({ reloading: true, reloadTimer: RELOAD_TIME * 0.55 });

    idle.weapon.updateWeapon(1 / 60);
    reloading.weapon.updateWeapon(1 / 60);

    const before = idle.weapon.weapon.position;
    const after = reloading.weapon.weapon.position;
    expect(after.y).toBeLessThan(before.y);
    expect(after.z).toBeGreaterThan(before.z);
    expect(Math.abs(reloading.weapon.weapon.rotation.x)).toBeGreaterThan(0.1);
  });

  it("puts both bones back once the reload finishes", async () => {
    const { weapon, ctx, model, slideRest, magazineRest } = await rigHarness({
      reloading: true,
      reloadTimer: RELOAD_TIME * 0.55,
    });

    weapon.updateWeapon(1 / 60);
    expect(model().magazine.position.y).not.toBeCloseTo(magazineRest().y, 3);

    // Offsets are recomputed from rest every frame rather than accumulated, so
    // the magazine snaps home the moment the reload flag clears. A rig that
    // integrated its own offsets would drift a little further down each reload.
    ctx.reloading = false;
    ctx.reloadTimer = 0;
    weapon.updateWeapon(1 / 60);

    expect(model().slide.position.toArray()).toEqual(slideRest().toArray());
    expect(model().magazine.position.toArray()).toEqual(magazineRest().toArray());
  });

  it("drives the off-hand rig with the same pose while dual-wielding", async () => {
    const { weapon, ctx, model, dual } = await rigHarness({
      reloading: true,
      reloadTimer: RELOAD_TIME * 0.55,
      dualWeaponTimer: 4,
    });

    weapon.updateWeapon(1 / 60);

    const off = dual();
    expect(off).not.toBeNull();
    expect(off?.group.visible).toBe(true);
    // Both hands reload together, from each rig's own rest pose.
    expect(off?.magazine.position.y).toBeCloseTo(model().magazine.position.y, 5);
    expect(off?.slide.position.z).toBeCloseTo(model().slide.position.z, 5);
    // The pair is offset apart so it does not read as one gun.
    expect(model().group.position.x).toBeLessThan(0);
    expect(off?.group.position.x).toBeGreaterThan(0);

    // Aiming down the sights puts the off-hand away again — you cannot look
    // through a scope past a second gun.
    ctx.aimingDownSights = true;
    for (let frame = 0; frame < 30; frame += 1) weapon.updateWeapon(1 / 60);
    expect(ctx.adsT).toBeGreaterThan(0.45);
    expect(off?.group.visible).toBe(false);
    expect(model().group.position.x).toBe(0);
  });

  it("animates a weapon that has no off-hand at all", async () => {
    // The cannon is the one gun with dualCompatible false, so dualModel stays
    // null. applyPose must not assume a pair.
    const { weapon, model, dual, slideRest } = await rigHarness({
      activeWeapon: "cannon",
      reloading: true,
      reloadTimer: RELOAD_TIME * 0.2,
      dualWeaponTimer: 4,
    });

    expect(dual()).toBeNull();
    expect(() => weapon.updateWeapon(1 / 60)).not.toThrow();
    expect(model().slide.position.z).toBeCloseTo(slideRest().z + 0.065, 5);
  });

  it("rebuilds the rig when the tier changes under it, and re-captures its rests", async () => {
    const { weapon, model, ctx, magazineRest } = await rigHarness({});

    weapon.updateWeapon(1 / 60);
    expect(model().group.name).toBe("weapon-view-pistol-base");
    const baseRig = model().group;
    const baseScale = baseRig.scale.x;

    ctx.sandboxWeaponTier = "evolved";
    weapon.updateWeapon(1 / 60);

    const evolvedRig = model().group;
    expect(evolvedRig).not.toBe(baseRig);
    expect(evolvedRig.name).toBe("weapon-view-pistol-evolved");
    expect(evolvedRig.scale.x).toBeGreaterThan(baseScale);
    // The old rig is off the graph, not merely hidden behind the new one.
    expect(baseRig.parent).toBeNull();

    // Rest vectors were re-captured from the new rig, so the reload still lands
    // on the right bone after a mid-fight upgrade.
    const rest = magazineRest();
    ctx.reloading = true;
    ctx.reloadTimer = RELOAD_TIME * 0.55;
    weapon.updateWeapon(1 / 60);
    expect(model().magazine.position.y).toBeCloseTo(rest.y - 0.34, 5);
  });
});

/**
 * Build a real WeaponSystem with a real procedural rig attached.
 *
 * `new` rather than `Object.create` on purpose: the rest vectors are class
 * fields, and skipping the initialisers would leave them undefined and every
 * pose assertion reading NaN.
 *
 * Imported lazily so the AudioEngine mock is installed first — updateLanding
 * cues a thud on the frame the boots touch down.
 */
async function rigHarness(
  over: Partial<{
    activeWeapon: WeaponId;
    tier: MainWeaponVisualTier;
    reloading: boolean;
    reloadTimer: number;
    dualWeaponTimer: number;
  }>,
) {
  const { WeaponSystem } = await import("../../src/game/entities/WeaponSystem");
  const ctx = {
    activeWeapon: over.activeWeapon ?? "pistol",
    // Sandbox owns the tier directly, so no SurvivorsSystem fake is needed.
    survivors: false,
    sandbox: true,
    sandboxWeaponTier: over.tier ?? "base",
    status: "playing",
    aimingDownSights: false,
    adsT: 0,
    adsZoomIndex: 0,
    dualWeaponTimer: over.dualWeaponTimer ?? 0,
    damageBoostTimer: 0,
    firing: false,
    reloading: over.reloading ?? false,
    reloadTimer: over.reloadTimer ?? 0,
    time: 0,
    canJump: true,
    wantsCrouch: false,
    wantsSprint: false,
    stanceHeight: PLAYER_HEIGHT,
    velocity: new THREE.Vector3(),
    move: { forward: false, back: false, left: false, right: false },
    rig: {
      attach: new THREE.Group(),
      facing: new THREE.Quaternion(),
      setFov: () => {},
    },
  } as unknown as GameContext;
  const sys = { hud: { emit: () => {} } } as unknown as GameSystems;

  const weapon = new WeaponSystem(ctx, sys);
  weapon.buildWeapon();

  const internals = weapon as unknown as {
    primaryModel: ReturnType<typeof buildWeaponViewModel> | null;
    dualModel: ReturnType<typeof buildWeaponViewModel> | null;
    primarySlideRest: THREE.Vector3;
    primaryMagazineRest: THREE.Vector3;
  };

  return {
    ctx,
    weapon,
    model: () => {
      const model = internals.primaryModel;
      if (!model) throw new Error("primary rig missing");
      return model;
    },
    dual: () => internals.dualModel,
    // Read live rather than snapshotted: a rig swap re-captures both, and an
    // assertion against a stale rest would pass while the animation was
    // landing on the wrong bone.
    slideRest: () => internals.primarySlideRest.clone(),
    magazineRest: () => internals.primaryMagazineRest.clone(),
  };
}
