/**
 * Procedural Scourge bodies keep the runtime self-contained while still giving
 * every enemy a real articulated silhouette. One fixed hierarchy is reshaped
 * per kind so pooled enemies retain the mesh identities registered for hitscan.
 */

import * as THREE from "three";
import {
  createEnemyPose,
  ENEMY_POSE_JOINTS,
  type EnemyPose,
  type EnemyPoseJoint,
  type EnemyRigKind,
} from "./enemyAnimation";

export type { EnemyRigKind } from "./enemyAnimation";

export interface EnemyRigArm {
  upper: THREE.Group;
  fore: THREE.Group;
  hand: THREE.Group;
}

export interface EnemyRigLeg {
  thigh: THREE.Group;
  shin: THREE.Group;
  foot: THREE.Group;
}

export interface EnemyRigPalette {
  body: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
}

interface EnemyRigMeshes {
  pelvis: THREE.Mesh;
  spine: THREE.Mesh;
  head: THREE.Mesh;
  eyeL: THREE.Mesh;
  eyeR: THREE.Mesh;
  upperArmL: THREE.Mesh;
  foreArmL: THREE.Mesh;
  handL: THREE.Mesh;
  upperArmR: THREE.Mesh;
  foreArmR: THREE.Mesh;
  handR: THREE.Mesh;
  thighL: THREE.Mesh;
  shinL: THREE.Mesh;
  footL: THREE.Mesh;
  thighR: THREE.Mesh;
  shinR: THREE.Mesh;
  footR: THREE.Mesh;
  frontThighL: THREE.Mesh;
  frontShinL: THREE.Mesh;
  frontFootL: THREE.Mesh;
  frontThighR: THREE.Mesh;
  frontShinR: THREE.Mesh;
  frontFootR: THREE.Mesh;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  weapon: THREE.Mesh;
  shoulderL: THREE.Mesh;
  shoulderR: THREE.Mesh;
}

export interface EnemyRig {
  kind: EnemyRigKind;
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  armL: EnemyRigArm;
  armR: EnemyRigArm;
  legL: EnemyRigLeg;
  legR: EnemyRigLeg;
  frontLegL: EnemyRigLeg;
  frontLegR: EnemyRigLeg;
  wingL: THREE.Group;
  wingR: THREE.Group;
  muzzle: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
  materials: THREE.Material[];
  palette: EnemyRigPalette;
  bindPose: EnemyPose;
  jointObjects: Record<EnemyPoseJoint, THREE.Group>;
  meshes: EnemyRigMeshes;
  geometries: THREE.BufferGeometry[];
}

function createPalette(): EnemyRigPalette {
  return {
    body: new THREE.MeshStandardMaterial({
      color: 0xff5a3c,
      emissive: 0x351008,
      emissiveIntensity: 1,
      roughness: 0.58,
      metalness: 0.18,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x181b22,
      emissive: 0x08090c,
      emissiveIntensity: 0.45,
      roughness: 0.42,
      metalness: 0.48,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: 0x8bdc1f,
      emissive: 0x3d760b,
      emissiveIntensity: 1.35,
      roughness: 0.38,
      metalness: 0.12,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff3b30,
      emissiveIntensity: 2.2,
      roughness: 0.25,
      metalness: 0.1,
    }),
  };
}

/** Kept next to {@link createPalette} so a fifth slot cannot be added to one and
 *  missed in the other. */
const PALETTE_KEYS = ["body", "dark", "accent", "eye"] as const satisfies readonly (keyof EnemyRigPalette)[];

/**
 * Copy one palette's look onto another rig's own materials.
 *
 * For the corpse path: a body has to keep the elite tint / boss gold / ranged
 * cyan its enemy died wearing, but it must not *share* that enemy's materials.
 * The pool hands the dead enemy's rig straight to the next spawn, which restyles
 * it in place (`Enemy.applyStyle`) — a shared reference would recolour every
 * corpse still on the floor.
 */
export function copyEnemyRigPalette(source: EnemyRigPalette, target: EnemyRigPalette) {
  for (const key of PALETTE_KEYS) {
    const from = source[key];
    const to = target[key];
    to.color.copy(from.color);
    to.emissive.copy(from.emissive);
    to.emissiveIntensity = from.emissiveIntensity;
    to.roughness = from.roughness;
    to.metalness = from.metalness;
  }
}

/** Mesh keys that cast into the sun's shadow map.
 *
 *  Deliberately just the trunk. A rig is 28 meshes and a surge tops out at
 *  SURV_SWELL_CAP (88) live enemies, so casting from every limb would put ~2.5k
 *  extra draws through the shadow pass each frame — the billboard sprites this
 *  rig replaced cost one apiece. The trunk carries the whole readable
 *  silhouette at gameplay distance; a forearm's shadow is a few pixels nobody
 *  sees. Every mesh still RECEIVES, which is free by comparison: that is a
 *  lookup in the main pass, not another pass. */
const SHADOW_CASTERS = new Set<keyof EnemyRigMeshes>(["pelvis", "spine", "head"]);

function createMesh(geometry: THREE.BufferGeometry, material: THREE.Material, part: "body" | "head"): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.part = part;
  return mesh;
}

function createLimbChain(): EnemyRigLeg {
  const thigh = new THREE.Group();
  const shin = new THREE.Group();
  const foot = new THREE.Group();
  thigh.add(shin);
  shin.add(foot);
  return { thigh, shin, foot };
}

function setMesh(
  mesh: THREE.Mesh,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
) {
  mesh.material = material;
  mesh.position.set(x, y, z);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.visible = true;
  mesh.layers.enable(0);
}

function hideMesh(mesh: THREE.Mesh) {
  mesh.visible = false;
  mesh.layers.disableAll();
}

function setJoint(group: THREE.Group, x: number, y: number, z: number, rotationX = 0, rotationY = 0, rotationZ = 0) {
  group.position.set(x, y, z);
  group.rotation.set(rotationX, rotationY, rotationZ);
  group.scale.setScalar(1);
}

function captureBindPose(rig: EnemyRig) {
  for (const jointName of ENEMY_POSE_JOINTS) {
    const group = rig.jointObjects[jointName];
    const bind = rig.bindPose[jointName];
    bind.offsetX = group.position.x;
    bind.offsetY = group.position.y;
    bind.offsetZ = group.position.z;
    bind.rotationX = group.rotation.x;
    bind.rotationY = group.rotation.y;
    bind.rotationZ = group.rotation.z;
  }
}

function resetVisuals(rig: EnemyRig) {
  for (const mesh of Object.values(rig.meshes)) hideMesh(mesh);
  for (const jointName of ENEMY_POSE_JOINTS) setJoint(rig.jointObjects[jointName], 0, 0, 0);
  rig.root.scale.setScalar(1);
}

function configureEyes(rig: EnemyRig, x: number, y: number, z: number, scale = 1) {
  setMesh(rig.meshes.eyeL, rig.palette.eye, -x, y, z, 0.1 * scale, 0.075 * scale, 0.055 * scale);
  setMesh(rig.meshes.eyeR, rig.palette.eye, x, y, z, 0.1 * scale, 0.075 * scale, 0.055 * scale);
  rig.meshes.eyeL.layers.disableAll();
  rig.meshes.eyeR.layers.disableAll();
}

function configureHumanoidLeg(rig: EnemyRig, leg: EnemyRigLeg, side: -1 | 1, lengthScale: number, widthScale: number) {
  setJoint(leg.thigh, side * 0.25 * widthScale, -0.16, 0);
  setJoint(leg.shin, 0, -0.62 * lengthScale, 0);
  setJoint(leg.foot, 0, -0.58 * lengthScale, 0.09);
  const thighMesh = side < 0 ? rig.meshes.thighL : rig.meshes.thighR;
  const shinMesh = side < 0 ? rig.meshes.shinL : rig.meshes.shinR;
  const footMesh = side < 0 ? rig.meshes.footL : rig.meshes.footR;
  setMesh(thighMesh, rig.palette.body, 0, -0.31 * lengthScale, 0, 0.2 * widthScale, 0.34 * lengthScale, 0.2);
  setMesh(shinMesh, rig.palette.dark, 0, -0.29 * lengthScale, 0, 0.17 * widthScale, 0.31 * lengthScale, 0.17);
  setMesh(footMesh, rig.palette.dark, 0, -0.1, 0.12, 0.19 * widthScale, 0.12, 0.31);
}

function configureHumanoidArm(
  rig: EnemyRig,
  arm: EnemyRigArm,
  side: -1 | 1,
  shoulderX: number,
  shoulderY: number,
  lengthScale: number,
  heavy = false,
) {
  setJoint(arm.upper, side * shoulderX, shoulderY, 0, 0, 0, side * (heavy ? 0.1 : 0.04));
  setJoint(arm.fore, 0, -0.54 * lengthScale, 0);
  setJoint(arm.hand, 0, -0.5 * lengthScale, 0.03);
  const upperMesh = side < 0 ? rig.meshes.upperArmL : rig.meshes.upperArmR;
  const foreMesh = side < 0 ? rig.meshes.foreArmL : rig.meshes.foreArmR;
  const handMesh = side < 0 ? rig.meshes.handL : rig.meshes.handR;
  const width = heavy ? 0.25 : 0.18;
  setMesh(upperMesh, rig.palette.body, 0, -0.27 * lengthScale, 0, width, 0.3 * lengthScale, width);
  setMesh(foreMesh, rig.palette.dark, 0, -0.25 * lengthScale, 0, width * 0.84, 0.28 * lengthScale, width * 0.84);
  setMesh(handMesh, rig.palette.accent, 0, -0.12, 0.04, width * 0.92, 0.15, width * 1.08);
}

function configureMelee(rig: EnemyRig) {
  setJoint(rig.pelvis, 0, 0.84, 0);
  setJoint(rig.spine, 0, 0.24, 0, 0.16);
  setJoint(rig.head, 0, 0.92, 0.04, -0.09);
  setMesh(rig.meshes.pelvis, rig.palette.dark, 0, 0, 0, 0.58, 0.38, 0.46);
  setMesh(rig.meshes.spine, rig.palette.body, 0, 0.42, 0, 0.84, 0.56, 0.48);
  setMesh(rig.meshes.head, rig.palette.dark, 0, 0.15, 0, 0.48, 0.48, 0.46);
  configureEyes(rig, 0.13, 0.17, 0.24);
  configureHumanoidArm(rig, rig.armL, -1, 0.53, 0.72, 1);
  configureHumanoidArm(rig, rig.armR, 1, 0.53, 0.72, 1);
  configureHumanoidLeg(rig, rig.legL, -1, 1, 1);
  configureHumanoidLeg(rig, rig.legR, 1, 1, 1);
  rig.armR.hand.add(rig.muzzle);
  rig.muzzle.position.set(0, -0.16, 0.25);
}

function configureRanged(rig: EnemyRig) {
  setJoint(rig.pelvis, 0, 0.88, 0);
  setJoint(rig.spine, 0, 0.28, 0);
  setJoint(rig.head, 0, 0.94, 0);
  setMesh(rig.meshes.pelvis, rig.palette.dark, 0, 0, 0, 0.55, 0.4, 0.44);
  setMesh(rig.meshes.spine, rig.palette.body, 0, 0.43, 0, 0.76, 0.58, 0.44);
  setMesh(rig.meshes.head, rig.palette.dark, 0, 0.15, 0, 0.45, 0.5, 0.43);
  configureEyes(rig, 0.12, 0.17, 0.23);
  configureHumanoidArm(rig, rig.armL, -1, 0.48, 0.72, 0.96);
  configureHumanoidArm(rig, rig.armR, 1, 0.48, 0.72, 0.96);
  configureHumanoidLeg(rig, rig.legL, -1, 1.02, 0.92);
  configureHumanoidLeg(rig, rig.legR, 1, 1.02, 0.92);
  setMesh(rig.meshes.weapon, rig.palette.accent, 0, -0.04, 0.42, 0.13, 0.14, 0.62);
  rig.armR.hand.add(rig.muzzle);
  rig.muzzle.position.set(0, -0.04, 1.02);
}

function configureHoundLeg(rig: EnemyRig, leg: EnemyRigLeg, side: -1 | 1, front: boolean) {
  setJoint(leg.thigh, side * 0.34, front ? 0.08 : -0.02, front ? 0.63 : -0.45, front ? -0.12 : 0.08);
  setJoint(leg.shin, 0, -0.48, front ? 0.05 : -0.04, front ? -0.12 : 0.16);
  setJoint(leg.foot, 0, -0.42, 0.11);
  const thighMesh = front
    ? side < 0
      ? rig.meshes.frontThighL
      : rig.meshes.frontThighR
    : side < 0
      ? rig.meshes.thighL
      : rig.meshes.thighR;
  const shinMesh = front
    ? side < 0
      ? rig.meshes.frontShinL
      : rig.meshes.frontShinR
    : side < 0
      ? rig.meshes.shinL
      : rig.meshes.shinR;
  const footMesh = front
    ? side < 0
      ? rig.meshes.frontFootL
      : rig.meshes.frontFootR
    : side < 0
      ? rig.meshes.footL
      : rig.meshes.footR;
  setMesh(thighMesh, rig.palette.body, 0, -0.24, 0, 0.16, 0.27, 0.16);
  setMesh(shinMesh, rig.palette.dark, 0, -0.21, 0, 0.13, 0.24, 0.13);
  setMesh(footMesh, rig.palette.accent, 0, -0.07, 0.13, 0.14, 0.09, 0.25);
}

function configureHound(rig: EnemyRig) {
  setJoint(rig.pelvis, 0, 0.82, -0.3);
  setJoint(rig.spine, 0, 0.04, 0.34);
  setJoint(rig.head, 0, 0.08, 1.03, -0.08);
  setMesh(rig.meshes.pelvis, rig.palette.dark, 0, 0, 0, 0.58, 0.42, 0.62);
  setMesh(rig.meshes.spine, rig.palette.body, 0, 0.08, 0.26, 0.62, 0.48, 1.18);
  setMesh(rig.meshes.head, rig.palette.dark, 0, 0.02, 0.2, 0.48, 0.42, 0.68);
  configureEyes(rig, 0.15, 0.08, 0.56, 0.88);
  configureHoundLeg(rig, rig.legL, -1, false);
  configureHoundLeg(rig, rig.legR, 1, false);
  configureHoundLeg(rig, rig.frontLegL, -1, true);
  configureHoundLeg(rig, rig.frontLegR, 1, true);
  rig.head.add(rig.muzzle);
  rig.muzzle.position.set(0, -0.02, 0.68);
}

function configureFlying(rig: EnemyRig) {
  setJoint(rig.pelvis, 0, 0.44, 0, 0.08);
  setJoint(rig.spine, 0, 0.28, 0, -0.08);
  setJoint(rig.head, 0, 0.9, 0);
  setJoint(rig.wingL, -0.36, 0.73, -0.18, 0.08, 0.1, -0.38);
  setJoint(rig.wingR, 0.36, 0.73, -0.18, 0.08, -0.1, 0.38);
  setMesh(rig.meshes.pelvis, rig.palette.dark, 0, 0, 0, 0.46, 0.34, 0.4);
  setMesh(rig.meshes.spine, rig.palette.body, 0, 0.39, 0, 0.65, 0.52, 0.4);
  setMesh(rig.meshes.head, rig.palette.dark, 0, 0.14, 0, 0.42, 0.44, 0.4);
  configureEyes(rig, 0.11, 0.15, 0.22, 0.9);
  configureHumanoidArm(rig, rig.armL, -1, 0.43, 0.66, 0.82);
  configureHumanoidArm(rig, rig.armR, 1, 0.43, 0.66, 0.82);
  setMesh(rig.meshes.wingL, rig.palette.accent, -0.66, 0, 0, 1.18, 0.09, 0.48);
  setMesh(rig.meshes.wingR, rig.palette.accent, 0.66, 0, 0, 1.18, 0.09, 0.48);
  rig.head.add(rig.muzzle);
  rig.muzzle.position.set(0, 0.02, 0.44);
}

function configureBoss(rig: EnemyRig) {
  setJoint(rig.pelvis, 0, 0.94, 0);
  setJoint(rig.spine, 0, 0.3, 0, 0.07);
  setJoint(rig.head, 0.08, 1.08, 0, -0.04, 0, 0.06);
  setMesh(rig.meshes.pelvis, rig.palette.dark, 0, 0, 0, 0.82, 0.5, 0.62);
  setMesh(rig.meshes.spine, rig.palette.body, 0, 0.52, 0, 1.15, 0.72, 0.62);
  setMesh(rig.meshes.head, rig.palette.dark, 0, 0.18, 0, 0.62, 0.62, 0.58);
  configureEyes(rig, 0.17, 0.21, 0.3, 1.25);
  configureHumanoidArm(rig, rig.armL, -1, 0.72, 0.86, 1.18, true);
  configureHumanoidArm(rig, rig.armR, 1, 0.78, 0.83, 1.3, true);
  configureHumanoidLeg(rig, rig.legL, -1, 1.16, 1.18);
  configureHumanoidLeg(rig, rig.legR, 1, 1.16, 1.18);
  setMesh(rig.meshes.shoulderL, rig.palette.dark, -0.78, 0.86, -0.02, 0.48, 0.34, 0.56);
  setMesh(rig.meshes.shoulderR, rig.palette.accent, 0.84, 0.9, 0.01, 0.62, 0.44, 0.68);
  setMesh(rig.meshes.weapon, rig.palette.accent, 0, -0.08, 0.48, 0.19, 0.2, 0.72);
  rig.armR.hand.add(rig.muzzle);
  rig.muzzle.position.set(0, -0.08, 1.2);
}

/**
 * Reshape a pooled rig without replacing any hit mesh. Inactive anatomy has its
 * raycast layers disabled because Raycaster receives these meshes directly.
 */
export function configureEnemyRig(rig: EnemyRig, kind: EnemyRigKind) {
  resetVisuals(rig);
  rig.kind = kind;
  rig.muzzle.removeFromParent();
  rig.muzzle.position.set(0, 0, 0);
  rig.muzzle.rotation.set(0, 0, 0);

  if (kind === "ranged") configureRanged(rig);
  else if (kind === "hound") configureHound(rig);
  else if (kind === "flying") configureFlying(rig);
  else if (kind === "boss") configureBoss(rig);
  else configureMelee(rig);

  captureBindPose(rig);
  resetEnemyRigPose(rig);
}

/** Restore the authored bind transform before a pooled enemy is re-armed. */
export function resetEnemyRigPose(rig: EnemyRig) {
  for (const jointName of ENEMY_POSE_JOINTS) {
    const group = rig.jointObjects[jointName];
    const bind = rig.bindPose[jointName];
    group.position.set(bind.offsetX, bind.offsetY, bind.offsetZ);
    group.rotation.set(bind.rotationX, bind.rotationY, bind.rotationZ);
  }
  rig.root.scale.setScalar(1);
}

/** Apply an additive numeric pose to the configured bind hierarchy. */
export function applyEnemyRigPose(rig: EnemyRig, pose: EnemyPose) {
  for (const jointName of ENEMY_POSE_JOINTS) {
    const group = rig.jointObjects[jointName];
    const bind = rig.bindPose[jointName];
    const joint = pose[jointName];
    group.position.set(bind.offsetX + joint.offsetX, bind.offsetY + joint.offsetY, bind.offsetZ + joint.offsetZ);
    group.rotation.set(
      bind.rotationX + joint.rotationX,
      bind.rotationY + joint.rotationY,
      bind.rotationZ + joint.rotationZ,
    );
  }
}

/** Build one stable-identity hierarchy that can be reused for every pool spawn. */
export function buildEnemyRig(kind: EnemyRigKind): EnemyRig {
  const palette = createPalette();
  const capsule = new THREE.CapsuleGeometry(0.5, 1, 5, 8);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wedge = new THREE.ConeGeometry(0.5, 1, 4);

  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  const spine = new THREE.Group();
  const head = new THREE.Group();
  const armLChain = createLimbChain();
  const armRChain = createLimbChain();
  const legL = createLimbChain();
  const legR = createLimbChain();
  const frontLegL = createLimbChain();
  const frontLegR = createLimbChain();
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  const muzzle = new THREE.Object3D();
  const armL: EnemyRigArm = { upper: armLChain.thigh, fore: armLChain.shin, hand: armLChain.foot };
  const armR: EnemyRigArm = { upper: armRChain.thigh, fore: armRChain.shin, hand: armRChain.foot };

  root.add(pelvis);
  pelvis.add(spine, legL.thigh, legR.thigh);
  spine.add(head, armL.upper, armR.upper, frontLegL.thigh, frontLegR.thigh, wingL, wingR);

  const meshes: EnemyRigMeshes = {
    pelvis: createMesh(capsule, palette.dark, "body"),
    spine: createMesh(box, palette.body, "body"),
    head: createMesh(box, palette.dark, "head"),
    eyeL: createMesh(box, palette.eye, "head"),
    eyeR: createMesh(box, palette.eye, "head"),
    upperArmL: createMesh(capsule, palette.body, "body"),
    foreArmL: createMesh(capsule, palette.dark, "body"),
    handL: createMesh(box, palette.accent, "body"),
    upperArmR: createMesh(capsule, palette.body, "body"),
    foreArmR: createMesh(capsule, palette.dark, "body"),
    handR: createMesh(box, palette.accent, "body"),
    thighL: createMesh(capsule, palette.body, "body"),
    shinL: createMesh(capsule, palette.dark, "body"),
    footL: createMesh(box, palette.dark, "body"),
    thighR: createMesh(capsule, palette.body, "body"),
    shinR: createMesh(capsule, palette.dark, "body"),
    footR: createMesh(box, palette.dark, "body"),
    frontThighL: createMesh(capsule, palette.body, "body"),
    frontShinL: createMesh(capsule, palette.dark, "body"),
    frontFootL: createMesh(box, palette.accent, "body"),
    frontThighR: createMesh(capsule, palette.body, "body"),
    frontShinR: createMesh(capsule, palette.dark, "body"),
    frontFootR: createMesh(box, palette.accent, "body"),
    wingL: createMesh(wedge, palette.accent, "body"),
    wingR: createMesh(wedge, palette.accent, "body"),
    weapon: createMesh(box, palette.accent, "body"),
    shoulderL: createMesh(box, palette.dark, "body"),
    shoulderR: createMesh(box, palette.accent, "body"),
  };

  for (const key of SHADOW_CASTERS) meshes[key].castShadow = true;

  pelvis.add(meshes.pelvis);
  spine.add(meshes.spine, meshes.shoulderL, meshes.shoulderR);
  head.add(meshes.head, meshes.eyeL, meshes.eyeR);
  armL.upper.add(meshes.upperArmL);
  armL.fore.add(meshes.foreArmL);
  armL.hand.add(meshes.handL);
  armR.upper.add(meshes.upperArmR);
  armR.fore.add(meshes.foreArmR);
  armR.hand.add(meshes.handR, meshes.weapon);
  legL.thigh.add(meshes.thighL);
  legL.shin.add(meshes.shinL);
  legL.foot.add(meshes.footL);
  legR.thigh.add(meshes.thighR);
  legR.shin.add(meshes.shinR);
  legR.foot.add(meshes.footR);
  frontLegL.thigh.add(meshes.frontThighL);
  frontLegL.shin.add(meshes.frontShinL);
  frontLegL.foot.add(meshes.frontFootL);
  frontLegR.thigh.add(meshes.frontThighR);
  frontLegR.shin.add(meshes.frontShinR);
  frontLegR.foot.add(meshes.frontFootR);
  wingL.add(meshes.wingL);
  wingR.add(meshes.wingR);

  const jointObjects: Record<EnemyPoseJoint, THREE.Group> = {
    root,
    pelvis,
    spine,
    head,
    upperArmL: armL.upper,
    foreArmL: armL.fore,
    handL: armL.hand,
    upperArmR: armR.upper,
    foreArmR: armR.fore,
    handR: armR.hand,
    thighL: legL.thigh,
    shinL: legL.shin,
    footL: legL.foot,
    thighR: legR.thigh,
    shinR: legR.shin,
    footR: legR.foot,
    frontThighL: frontLegL.thigh,
    frontShinL: frontLegL.shin,
    frontFootL: frontLegL.foot,
    frontThighR: frontLegR.thigh,
    frontShinR: frontLegR.shin,
    frontFootR: frontLegR.foot,
    wingL,
    wingR,
  };
  const hitMeshes = [
    meshes.pelvis,
    meshes.spine,
    meshes.head,
    meshes.upperArmL,
    meshes.foreArmL,
    meshes.handL,
    meshes.upperArmR,
    meshes.foreArmR,
    meshes.handR,
    meshes.thighL,
    meshes.shinL,
    meshes.footL,
    meshes.thighR,
    meshes.shinR,
    meshes.footR,
    meshes.frontThighL,
    meshes.frontShinL,
    meshes.frontFootL,
    meshes.frontThighR,
    meshes.frontShinR,
    meshes.frontFootR,
    meshes.wingL,
    meshes.wingR,
    meshes.shoulderL,
    meshes.shoulderR,
  ];
  const materials = [palette.body, palette.dark, palette.accent, palette.eye];
  const rig: EnemyRig = {
    kind,
    root,
    pelvis,
    spine,
    head,
    armL,
    armR,
    legL,
    legR,
    frontLegL,
    frontLegR,
    wingL,
    wingR,
    muzzle,
    hitMeshes,
    materials,
    palette,
    bindPose: createEnemyPose(),
    jointObjects,
    meshes,
    geometries: [capsule, box, wedge],
  };

  configureEnemyRig(rig, kind);
  return rig;
}

/** Release the small shared-per-rig geometry and material set exactly once. */
export function disposeEnemyRig(rig: EnemyRig) {
  for (const geometry of rig.geometries) geometry.dispose();
  for (const material of rig.materials) material.dispose();
  rig.root.removeFromParent();
}
