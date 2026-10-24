import * as THREE from "three";
import { WEAPONS, type WeaponId } from "../../constants";
import { type MainWeaponVisualTier, mainWeaponTierIndex } from "../../data/survivors";
import { mainWeaponTierViewScale } from "../../data/weaponView";

/**
 * Named procedural view-model parts. The animator operates on these stable
 * transform seams and never needs to know which primitives form a silhouette.
 * Resource arrays make weapon/tier swaps explicitly disposable.
 */
export interface WeaponViewModel {
  group: THREE.Group;
  body: THREE.Group;
  slide: THREE.Group;
  magazine: THREE.Group;
  muzzle: THREE.Object3D;
  eject: THREE.Object3D;
  foregrip?: THREE.Object3D;
  stock?: THREE.Object3D;
  sight?: THREE.Object3D;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  accentMaterials: THREE.MeshStandardMaterial[];
}

interface ModelParts {
  group: THREE.Group;
  body: THREE.Group;
  slide: THREE.Group;
  magazine: THREE.Group;
  muzzle: THREE.Object3D;
  eject: THREE.Object3D;
  foregrip?: THREE.Object3D;
  stock?: THREE.Object3D;
  sight?: THREE.Object3D;
}

interface HardwarePlacement {
  receiverLength: number;
  railY: number;
  muzzleZ: number;
  width: number;
}

class WeaponModelBuilder {
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly materials: THREE.Material[] = [];
  readonly accentMaterials: THREE.MeshStandardMaterial[] = [];

  material(
    color: number,
    roughness: number,
    metalness: number,
    emissive = 0x000000,
    emissiveIntensity = 0,
  ): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.materials.push(material);
    if (emissive !== 0x000000) this.accentMaterials.push(material);
    return material;
  }

  box(
    parent: THREE.Object3D,
    name: string,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    material: THREE.Material,
    rotation: readonly [number, number, number] = [0, 0, 0],
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.renderOrder = 20;
    parent.add(mesh);
    return mesh;
  }

  cylinder(
    parent: THREE.Object3D,
    name: string,
    radiusTop: number,
    radiusBottom: number,
    length: number,
    position: readonly [number, number, number],
    material: THREE.Material,
    sides = 10,
  ): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides);
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.x = Math.PI / 2;
    mesh.renderOrder = 20;
    parent.add(mesh);
    return mesh;
  }
}

function group(name: string, parent?: THREE.Object3D): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  parent?.add(result);
  return result;
}

function muzzleMarker(parent: THREE.Object3D, z: number, y: number): THREE.Object3D {
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle";
  muzzle.position.set(0, y, z);
  parent.add(muzzle);
  return muzzle;
}

/**
 * Ejection port, on the receiver's right flank. Parented to `body` rather than
 * `slide` on purpose: the port is a hole in the frame, and a marker riding the
 * reciprocating slide would fling brass out of position through a reload.
 */
function ejectMarker(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const eject = new THREE.Object3D();
  eject.name = "eject";
  eject.position.set(x, y, z);
  parent.add(eject);
  return eject;
}

function addTierHardware(
  builder: WeaponModelBuilder,
  parts: ModelParts,
  placement: HardwarePlacement,
  tier: MainWeaponVisualTier,
  dark: THREE.MeshStandardMaterial,
  accent: THREE.MeshStandardMaterial,
): void {
  const tierIndex = mainWeaponTierIndex(tier);
  if (tierIndex >= 1) {
    builder.box(
      parts.body,
      "tier-rail",
      [placement.width * 0.72, 0.025, placement.receiverLength * 0.72],
      [0, placement.railY, -placement.receiverLength * 0.18],
      dark,
    );
  }
  if (tierIndex >= 2) {
    builder.cylinder(
      parts.body,
      "tier-compensator",
      placement.width * 0.25,
      placement.width * 0.29,
      0.13,
      [0, parts.muzzle.position.y, placement.muzzleZ + 0.055],
      dark,
      8,
    );
    builder.box(
      parts.body,
      "tier-side-rail",
      [0.018, placement.width * 0.48, placement.receiverLength * 0.42],
      [placement.width * 0.55, placement.railY - 0.07, -placement.receiverLength * 0.2],
      accent,
    );
  }
  if (tierIndex >= 3) {
    builder.box(parts.magazine, "extended-magazine", [placement.width * 0.82, 0.14, 0.11], [0, -0.08, 0], dark);
    builder.box(
      parts.body,
      "tier-lower-rail",
      [placement.width * 0.62, 0.025, placement.receiverLength * 0.34],
      [0, -placement.width * 0.65, -placement.receiverLength * 0.34],
      dark,
    );
  }
  if (tierIndex >= 4) {
    builder.box(
      parts.body,
      "evolved-core-left",
      [0.018, 0.07, placement.receiverLength * 0.62],
      [-placement.width * 0.57, 0.015, -placement.receiverLength * 0.18],
      accent,
    );
    builder.box(
      parts.body,
      "evolved-core-right",
      [0.018, 0.07, placement.receiverLength * 0.62],
      [placement.width * 0.57, 0.015, -placement.receiverLength * 0.18],
      accent,
    );
    builder.box(
      parts.body,
      "evolved-muzzle-fin",
      [placement.width * 1.05, 0.025, 0.14],
      [0, parts.muzzle.position.y + placement.width * 0.48, placement.muzzleZ + 0.05],
      accent,
    );
  }
}

function buildPistol(builder: WeaponModelBuilder, tier: MainWeaponVisualTier): ModelParts {
  const root = group("pistol");
  const body = group("body", root);
  const slide = group("slide", root);
  const magazine = group("magazine", root);
  const dark = builder.material(0x15181c, 0.48, 0.78);
  const steel = builder.material(0x343a41, 0.4, 0.82);
  const grip = builder.material(0x231c1a, 0.78, 0.18);
  const accent = builder.material(0xff6a00, 0.34, 0.55, 0xff4300, 1.1 + mainWeaponTierIndex(tier) * 0.22);

  builder.box(body, "receiver", [0.18, 0.14, 0.34], [0, 0.015, -0.12], steel);
  builder.box(body, "trigger-guard", [0.13, 0.035, 0.12], [0, -0.095, -0.04], dark);
  builder.box(body, "grip", [0.14, 0.27, 0.15], [0, -0.18, 0.015], grip, [0.2, 0, 0]);
  builder.cylinder(body, "barrel", 0.032, 0.032, 0.3, [0, 0.06, -0.32], dark, 12);
  builder.box(slide, "reciprocating-slide", [0.19, 0.095, 0.39], [0, 0.085, -0.13], steel);
  builder.box(slide, "slide-accent", [0.16, 0.018, 0.16], [0, 0.137, -0.18], accent);
  magazine.position.set(0, -0.255, 0.028);
  builder.box(magazine, "magazine-body", [0.105, 0.19, 0.105], [0, 0, 0], dark, [0.2, 0, 0]);
  const sight = builder.box(slide, "iron-sight", [0.045, 0.035, 0.04], [0, 0.15, -0.25], accent);
  const muzzle = muzzleMarker(body, -0.49, 0.06);
  const eject = ejectMarker(body, 0.1, 0.09, -0.1);
  const parts = { group: root, body, slide, magazine, muzzle, eject, sight };
  addTierHardware(
    builder,
    parts,
    { receiverLength: 0.34, railY: 0.15, muzzleZ: -0.49, width: 0.18 },
    tier,
    dark,
    accent,
  );
  return parts;
}

function buildSmg(builder: WeaponModelBuilder, tier: MainWeaponVisualTier): ModelParts {
  const root = group("smg");
  const body = group("body", root);
  const slide = group("slide", root);
  const magazine = group("magazine", root);
  const dark = builder.material(0x15141b, 0.46, 0.72);
  const steel = builder.material(0x30313a, 0.42, 0.76);
  const polymer = builder.material(0x211d27, 0.72, 0.25);
  const accent = builder.material(0x9b5cff, 0.3, 0.5, 0x7134ff, 1.25 + mainWeaponTierIndex(tier) * 0.22);

  builder.box(body, "receiver", [0.22, 0.19, 0.47], [0, 0.015, -0.17], steel);
  builder.box(body, "receiver-shroud", [0.25, 0.12, 0.3], [0, 0.02, -0.38], polymer);
  builder.cylinder(body, "barrel", 0.038, 0.038, 0.34, [0, 0.035, -0.58], dark, 12);
  builder.cylinder(body, "muzzle-brake", 0.055, 0.055, 0.1, [0, 0.035, -0.78], dark, 8);
  builder.box(slide, "charging-bolt", [0.13, 0.055, 0.21], [0, 0.115, -0.19], dark);
  builder.box(slide, "bolt-accent", [0.09, 0.016, 0.11], [0, 0.151, -0.2], accent);
  builder.box(body, "grip", [0.13, 0.27, 0.14], [0, -0.18, -0.02], polymer, [0.16, 0, 0]);
  magazine.position.set(0, -0.25, -0.13);
  builder.box(magazine, "stick-magazine", [0.11, 0.31, 0.13], [0, 0, 0], dark, [-0.08, 0, 0]);
  const foregrip = builder.box(body, "foregrip", [0.1, 0.18, 0.11], [0, -0.14, -0.39], polymer, [-0.12, 0, 0]);
  const stock = group("stock", body);
  builder.box(stock, "stock-strut", [0.055, 0.055, 0.34], [0, 0.04, 0.21], dark, [0.08, 0, 0]);
  builder.box(stock, "stock-pad", [0.19, 0.25, 0.055], [0, -0.025, 0.39], polymer, [0.08, 0, 0]);
  const sight = builder.box(body, "reflex-sight", [0.11, 0.1, 0.12], [0, 0.17, -0.22], accent);
  const muzzle = muzzleMarker(body, -0.84, 0.035);
  const eject = ejectMarker(body, 0.12, 0.1, -0.16);
  const parts = { group: root, body, slide, magazine, muzzle, eject, foregrip, stock, sight };
  addTierHardware(
    builder,
    parts,
    { receiverLength: 0.47, railY: 0.14, muzzleZ: -0.84, width: 0.22 },
    tier,
    dark,
    accent,
  );
  return parts;
}

function buildShotgun(builder: WeaponModelBuilder, tier: MainWeaponVisualTier): ModelParts {
  const root = group("shotgun");
  const body = group("body", root);
  const slide = group("slide", root);
  const magazine = group("magazine", root);
  const dark = builder.material(0x171719, 0.5, 0.72);
  const steel = builder.material(0x414044, 0.43, 0.8);
  const furniture = builder.material(0x35221a, 0.72, 0.28);
  const accent = builder.material(0xffb02e, 0.34, 0.5, 0xff7b00, 1.2 + mainWeaponTierIndex(tier) * 0.2);

  builder.box(body, "receiver", [0.25, 0.2, 0.49], [0, 0, -0.12], steel);
  builder.cylinder(body, "barrel", 0.052, 0.052, 0.7, [0, 0.07, -0.62], dark, 14);
  builder.cylinder(body, "tube-magazine", 0.041, 0.041, 0.57, [0, -0.045, -0.55], steel, 12);
  builder.box(body, "pistol-grip", [0.14, 0.27, 0.16], [0, -0.19, 0.05], furniture, [0.22, 0, 0]);
  builder.box(slide, "pump-bolt", [0.23, 0.14, 0.29], [0, -0.015, -0.48], furniture);
  builder.box(slide, "pump-accent", [0.19, 0.02, 0.2], [0, -0.091, -0.48], accent);
  magazine.position.set(0, -0.14, -0.08);
  builder.box(magazine, "shell-carrier", [0.13, 0.19, 0.12], [0, 0, 0], dark);
  const foregrip = slide;
  const stock = group("stock", body);
  builder.box(stock, "stock-neck", [0.15, 0.15, 0.32], [0, -0.005, 0.29], furniture, [-0.08, 0, 0]);
  builder.box(stock, "stock-pad", [0.22, 0.3, 0.08], [0, -0.08, 0.49], dark, [-0.08, 0, 0]);
  const sight = builder.box(body, "front-bead", [0.035, 0.04, 0.035], [0, 0.135, -0.86], accent);
  const muzzle = muzzleMarker(body, -0.98, 0.07);
  const eject = ejectMarker(body, 0.14, 0.03, -0.1);
  const parts = { group: root, body, slide, magazine, muzzle, eject, foregrip, stock, sight };
  addTierHardware(
    builder,
    parts,
    { receiverLength: 0.49, railY: 0.13, muzzleZ: -0.98, width: 0.25 },
    tier,
    dark,
    accent,
  );
  return parts;
}

function buildCannon(builder: WeaponModelBuilder, tier: MainWeaponVisualTier): ModelParts {
  const root = group("cannon");
  const body = group("body", root);
  const slide = group("slide", root);
  const magazine = group("magazine", root);
  const dark = builder.material(0x17151a, 0.43, 0.82);
  const steel = builder.material(0x3c343d, 0.38, 0.86);
  const armor = builder.material(0x532033, 0.52, 0.62);
  const accent = builder.material(0xff3b6b, 0.28, 0.48, 0xff174f, 1.45 + mainWeaponTierIndex(tier) * 0.25);

  builder.cylinder(body, "receiver", 0.17, 0.2, 0.52, [0, 0, -0.13], steel, 10);
  builder.box(body, "receiver-armor", [0.37, 0.19, 0.38], [0, 0.02, -0.18], armor);
  builder.cylinder(body, "heavy-barrel", 0.085, 0.105, 0.64, [0, 0.04, -0.68], dark, 12);
  builder.cylinder(body, "blast-collar", 0.15, 0.12, 0.17, [0, 0.04, -1.04], steel, 8);
  builder.box(slide, "recoil-breech", [0.26, 0.18, 0.26], [0, 0.055, -0.27], dark);
  builder.box(slide, "breech-core", [0.17, 0.04, 0.16], [0, 0.17, -0.27], accent);
  magazine.position.set(0, -0.23, -0.12);
  builder.cylinder(magazine, "drum-magazine", 0.17, 0.17, 0.18, [0, 0, 0], armor, 12);
  magazine.rotation.z = Math.PI / 2;
  const foregrip = builder.box(body, "brace-grip", [0.14, 0.24, 0.16], [0, -0.22, -0.43], dark, [-0.1, 0, 0]);
  const stock = group("stock", body);
  builder.box(stock, "rear-brace", [0.27, 0.23, 0.35], [0, -0.02, 0.31], armor, [-0.08, 0, 0]);
  builder.box(stock, "brace-pad", [0.34, 0.34, 0.09], [0, -0.09, 0.52], dark, [-0.08, 0, 0]);
  const sight = builder.box(body, "range-sight", [0.14, 0.12, 0.18], [0, 0.22, -0.23], accent);
  const muzzle = muzzleMarker(body, -1.16, 0.04);
  const eject = ejectMarker(body, 0.2, 0.06, -0.22);
  const parts = { group: root, body, slide, magazine, muzzle, eject, foregrip, stock, sight };
  addTierHardware(
    builder,
    parts,
    { receiverLength: 0.52, railY: 0.2, muzzleZ: -1.16, width: 0.34 },
    tier,
    dark,
    accent,
  );
  return parts;
}

function buildSniper(builder: WeaponModelBuilder, tier: MainWeaponVisualTier): ModelParts {
  const root = group("sniper");
  const body = group("body", root);
  const slide = group("slide", root);
  const magazine = group("magazine", root);
  const dark = builder.material(0x151718, 0.44, 0.82);
  const steel = builder.material(0x35393a, 0.38, 0.86);
  const furniture = builder.material(0x262b2a, 0.63, 0.38);
  const accent = builder.material(0xd7d2c4, 0.27, 0.62, 0x8ee8d2, 1.1 + mainWeaponTierIndex(tier) * 0.2);

  builder.box(body, "receiver", [0.2, 0.17, 0.52], [0, 0.01, -0.12], steel);
  builder.box(body, "chassis", [0.22, 0.1, 0.75], [0, -0.055, -0.28], furniture);
  builder.cylinder(body, "precision-barrel", 0.035, 0.045, 0.83, [0, 0.04, -0.8], dark, 14);
  builder.cylinder(body, "suppressor", 0.062, 0.062, 0.27, [0, 0.04, -1.33], steel, 14);
  builder.box(slide, "bolt-carrier", [0.12, 0.07, 0.25], [0, 0.105, -0.12], dark);
  builder.cylinder(slide, "bolt-handle", 0.022, 0.022, 0.13, [0.11, 0.095, -0.08], accent, 8);
  slide.children[slide.children.length - 1]?.rotateZ(Math.PI / 2);
  magazine.position.set(0, -0.2, -0.13);
  builder.box(magazine, "box-magazine", [0.12, 0.22, 0.14], [0, 0, 0], dark, [-0.06, 0, 0]);
  const foregrip = builder.box(body, "hand-stop", [0.11, 0.12, 0.11], [0, -0.15, -0.52], furniture);
  const stock = group("stock", body);
  builder.box(stock, "stock-comb", [0.18, 0.16, 0.48], [0, 0.015, 0.35], furniture, [-0.04, 0, 0]);
  builder.box(stock, "stock-pad", [0.22, 0.3, 0.07], [0, -0.06, 0.61], dark, [-0.04, 0, 0]);
  const sight = group("sight", body);
  builder.cylinder(sight, "scope-tube", 0.07, 0.07, 0.39, [0, 0.2, -0.12], dark, 14);
  builder.cylinder(sight, "scope-objective", 0.095, 0.095, 0.08, [0, 0.2, -0.32], accent, 14);
  const muzzle = muzzleMarker(body, -1.48, 0.04);
  const eject = ejectMarker(body, 0.12, 0.1, -0.1);
  const parts = { group: root, body, slide, magazine, muzzle, eject, foregrip, stock, sight };
  addTierHardware(
    builder,
    parts,
    { receiverLength: 0.52, railY: 0.16, muzzleZ: -1.48, width: 0.2 },
    tier,
    dark,
    accent,
  );
  return parts;
}

/**
 * Build one complete procedural weapon silhouette for the active weapon/tier.
 *
 * Geometry is intentionally authored in camera-local metres with the barrel
 * pointing down -Z. The existing tier scale remains the final root scale, while
 * tier hardware supplies a real silhouette/material progression.
 */
export function buildWeaponViewModel(id: WeaponId, tier: MainWeaponVisualTier): WeaponViewModel {
  const builder = new WeaponModelBuilder();
  let parts: ModelParts;
  switch (id) {
    case "pistol":
      parts = buildPistol(builder, tier);
      break;
    case "smg":
      parts = buildSmg(builder, tier);
      break;
    case "shotgun":
      parts = buildShotgun(builder, tier);
      break;
    case "cannon":
      parts = buildCannon(builder, tier);
      break;
    case "sniper":
      parts = buildSniper(builder, tier);
      break;
  }

  parts.group.name = `weapon-view-${id}-${tier}`;
  parts.group.scale.setScalar(mainWeaponTierViewScale(tier));
  parts.group.userData.weaponId = id;
  parts.group.userData.visualTier = tier;
  parts.group.userData.accent = WEAPONS[id].accent;
  return {
    ...parts,
    geometries: builder.geometries,
    materials: builder.materials,
    accentMaterials: builder.accentMaterials,
  };
}

/**
 * Release every GPU resource owned by a procedural model after a weapon/tier
 * swap. Shared muzzle-flash textures are not part of this ownership boundary.
 */
export function disposeWeaponViewModel(vm: WeaponViewModel): void {
  vm.group.removeFromParent();
  for (const geometry of vm.geometries) geometry.dispose();
  for (const material of vm.materials) material.dispose();
}
