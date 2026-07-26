import * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import type { GameContext } from "../context";
import type { StructureLeaf } from "../render/arenaGeometry";
import type { GameSystems } from "../systems";

/** Seconds a door takes to travel from fully closed to fully open. */
const LEAF_TRAVEL_TIME = 0.42;
/** Openness below which a leaf still blocks the player. Doors read as passable
 *  well before the swing finishes, so the collider lifts early rather than
 *  clipping the player's shoulder on a door that is visually out of the way. */
const BLOCKING_OPENNESS = 0.3;
/** How far in front of the player a leaf can be used, metres (from the eye to
 *  the centre of the clear cut). */
const INTERACT_RANGE = 2.6;
/** Minimum alignment between the look direction and the direction to a leaf for
 *  it to be the interact focus. cos(50°) — generous enough to grab a doorknob
 *  without hunting for a pixel. */
const INTERACT_AIM_DOT = 0.64;

/** One live door or window panel: the leaf's static description plus the
 *  mutable state the sim owns. */
interface LeafInstance {
  leaf: StructureLeaf;
  /** Hinge-anchored group; swinging rotates THIS, sliding translates it. */
  pivot: THREE.Group;
  panel: THREE.Mesh;
  /** Persistent collider identity. Pushed into / spliced out of
   *  ctx.obstacleBoxes as the panel opens and closes — never reallocated, so
   *  the splice can match by reference. */
  box: THREE.Box3;
  /** 0 = closed, 1 = fully open. Eased toward `target` each tick. */
  openness: number;
  target: number;
  locked: boolean;
  /** A glazed pane that has been shot out: no mesh, no collider, permanent. */
  broken: boolean;
  /** Whether `box` is currently inside ctx.obstacleBoxes. */
  blocking: boolean;
}

/** Doors and windows: the movable panels of the arena's enterable buildings.
 *
 *  ArenaSystem owns the static shell (walls, floor slabs, roof); this system
 *  owns everything that moves. The split matters for collision: shell walls are
 *  pushed into ctx.obstacleBoxes once at build time and never change, whereas a
 *  leaf's box comes and goes as it swings — so it is tracked by identity here
 *  and spliced out the moment the panel stops blocking.
 *
 *  Unglazed windows never reach this system (arenaGeometry omits them): an
 *  opening with nothing to move is just a hole in the wall. */
export class StructureSystem {
  private group: THREE.Group | null = null;
  private leaves: LeafInstance[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  /** Panel mesh → instance, so a hitscan that lands on glass can find its leaf. */
  private byMesh = new Map<THREE.Object3D, LeafInstance>();
  private focused: LeafInstance | null = null;
  /** Scratch look direction, recomputed from the rig each frame. Deliberately
   *  not ctx._fwd: that vector is WeaponSystem's shot-time scratch, refreshed
   *  only when the player fires or melees — reading it here would aim the
   *  interact focus with a stale direction, and with none at all before the
   *  first shot of a run. */
  private readonly forward = new THREE.Vector3();

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  /** Build the panels for a freshly-built arena. Called from ArenaSystem after
   *  the shell is in place, and only ever with that arena's leaves. */
  build(leaves: StructureLeaf[], doorMaterial: THREE.Material) {
    this.clear();
    if (leaves.length === 0) return;

    const group = new THREE.Group();
    this.group = group;
    this.ctx.scene.add(group);

    // One shared glass material for the whole arena: panes are the only
    // transparent surface here, so a single instance keeps the sorting cost flat.
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fd4e3,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      metalness: 0.1,
      emissive: 0x2b4d57,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });
    this.materials.push(glassMaterial);

    for (const leaf of leaves) {
      const geometry = new THREE.BoxGeometry(leaf.box.w, leaf.box.h, leaf.box.d);
      this.geometries.push(geometry);
      const panel = new THREE.Mesh(geometry, leaf.kind === "window" ? glassMaterial : doorMaterial);
      // The panel sits at its closed-pose offset from the hinge; the pivot group
      // carries the hinge itself, so rotating the group swings the panel through
      // the arc its arm describes.
      panel.position.set(leaf.arm.x, leaf.box.y - leaf.pivot.y, leaf.arm.z);
      panel.castShadow = true;
      panel.receiveShadow = leaf.kind === "door";
      // `solid` stops bullets; `pane` tells the hitscan it can shatter instead.
      panel.userData = { solid: true, pane: leaf.kind === "window" };

      const pivot = new THREE.Group();
      pivot.position.set(leaf.pivot.x, leaf.pivot.y, leaf.pivot.z);
      pivot.add(panel);
      group.add(pivot);

      const open = leaf.state === "open";
      const instance: LeafInstance = {
        leaf,
        pivot,
        panel,
        box: new THREE.Box3(),
        openness: open ? 1 : 0,
        target: open ? 1 : 0,
        locked: leaf.state === "locked",
        broken: false,
        blocking: false,
      };
      this.applyPose(instance);
      this.syncCollider(instance);
      this.leaves.push(instance);
      this.byMesh.set(panel, instance);
      this.ctx.raycastTargets.push(panel);
    }
  }

  /** Drop every panel and its collider. Called from ArenaSystem.clearArena, so
   *  it must be safe both before any build and between two of them. */
  clear() {
    for (const instance of this.leaves) this.setBlocking(instance, false);
    if (this.group) {
      this.ctx.scene.remove(this.group);
      this.group = null;
    }
    if (this.byMesh.size > 0) {
      const panels = this.byMesh;
      this.ctx.raycastTargets = this.ctx.raycastTargets.filter((o) => !panels.has(o));
    }
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries = [];
    this.materials = [];
    this.leaves = [];
    this.byMesh.clear();
    this.focused = null;
  }

  /** Advance every panel toward its target pose and refresh the interact focus. */
  update(delta: number) {
    if (this.leaves.length === 0) return;
    const step = delta / LEAF_TRAVEL_TIME;
    for (const instance of this.leaves) {
      if (instance.broken || instance.openness === instance.target) continue;
      instance.openness =
        instance.target > instance.openness
          ? Math.min(instance.target, instance.openness + step)
          : Math.max(instance.target, instance.openness - step);
      this.applyPose(instance);
      this.syncCollider(instance);
    }
    this.focused = this.findFocus();
  }

  /** Interact prompt for the leaf under the crosshair, or "" when nothing is in
   *  reach. Polled by the HUD each frame; the leading key hint matches the
   *  `interact` binding in `fpsActionMap`. */
  prompt(): string {
    const instance = this.focused;
    if (instance === null) return "";
    const noun = instance.leaf.kind === "window" ? "WINDOW" : "DOOR";
    if (instance.locked) return `${noun} LOCKED`;
    return `[E] ${instance.target < 0.5 ? "OPEN" : "CLOSE"} ${noun}`;
  }

  /** Toggle the focused leaf. Bound to the interact key; a no-op when nothing is
   *  in reach, and a refusal cue on a locked door. */
  interact() {
    const instance = this.focused;
    if (instance === null) return;
    if (instance.locked) {
      audio.sfx("doorLocked");
      this.sys.hud.showToast("LOCKED");
      return;
    }
    const opening = instance.target < 0.5;
    instance.target = opening ? 1 : 0;
    audio.sfx(opening ? "doorOpen" : "doorClose");
  }

  /** Shatter a glazed pane hit by a bullet. Returns false when the mesh is not a
   *  breakable pane, which is the hitscan's signal to treat it as a solid wall. */
  shatter(mesh: THREE.Object3D): boolean {
    const instance = this.byMesh.get(mesh);
    if (instance === undefined || instance.leaf.kind !== "window" || instance.broken) return false;
    instance.broken = true;
    instance.openness = 1;
    instance.target = 1;
    this.setBlocking(instance, false);
    instance.panel.visible = false;
    this.byMesh.delete(mesh);
    this.ctx.raycastTargets = this.ctx.raycastTargets.filter((o) => o !== mesh);
    const at = new THREE.Vector3(instance.leaf.center.x, instance.leaf.center.y, instance.leaf.center.z);
    this.sys.fx.spawnImpactSpark(at, 0xbfe6f2);
    audio.sfx("glassBreak");
    return true;
  }

  /** Place a panel for its current openness: swing rotates the hinge group,
   *  slide translates it. Both are driven from the same 0..1 scalar. */
  private applyPose(instance: LeafInstance) {
    const { leaf } = instance;
    instance.pivot.rotation.y = leaf.openYaw * instance.openness;
    instance.pivot.position.set(
      leaf.pivot.x + leaf.openSlide.x * instance.openness,
      leaf.pivot.y,
      leaf.pivot.z + leaf.openSlide.z * instance.openness,
    );
    instance.pivot.updateMatrixWorld(true);
  }

  /** Recompute the collider from the panel's current world pose and add or drop
   *  it from the player's push-out set. */
  private syncCollider(instance: LeafInstance) {
    const shouldBlock = !instance.broken && instance.openness < BLOCKING_OPENNESS;
    if (shouldBlock) instance.box.setFromObject(instance.panel);
    this.setBlocking(instance, shouldBlock);
  }

  private setBlocking(instance: LeafInstance, blocking: boolean) {
    if (blocking === instance.blocking) return;
    instance.blocking = blocking;
    if (blocking) {
      this.ctx.obstacleBoxes.push(instance.box);
      return;
    }
    const i = this.ctx.obstacleBoxes.indexOf(instance.box);
    if (i >= 0) this.ctx.obstacleBoxes.splice(i, 1);
  }

  /** Nearest leaf within reach that the player is roughly facing. Aims at the
   *  centre of the CLEAR cut rather than the panel, so a door stays usable from
   *  the same spot once it has swung away. */
  private findFocus(): LeafInstance | null {
    const eye = this.ctx.body.position;
    const forward = this.forward.set(0, 0, -1).applyQuaternion(this.ctx.rig.facing);
    let best: LeafInstance | null = null;
    let bestDistance = INTERACT_RANGE;
    for (const instance of this.leaves) {
      if (instance.broken) continue;
      const { center } = instance.leaf;
      const dx = center.x - eye.x;
      const dy = center.y - eye.y;
      const dz = center.z - eye.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > bestDistance || distance < 1e-3) continue;
      if ((dx * forward.x + dy * forward.y + dz * forward.z) / distance < INTERACT_AIM_DOT) continue;
      best = instance;
      bestDistance = distance;
    }
    return best;
  }
}
