import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { COLORS, CONSTANTS } from "../../src/game/constants";
import { CHAMPION_IDS, CHAMPIONS } from "../../src/game/data/champions";
import { makeBase, makeChampion, makeMinion, makeScourge, makeTower } from "../../src/game/factory";

function materialColors(root: THREE.Object3D): number[] {
  const colors: number[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        colors.push(material.color.getHex(), material.emissive.getHex());
      }
    }
  });

  return colors;
}

function geometryTypes(root: THREE.Object3D): string[] {
  const types: string[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) types.push(object.geometry.type);
  });
  return types;
}

describe("Pactfall visual contract", () => {
  test("uses the locked Deadrot palette tokens", () => {
    expect(COLORS).toEqual({
      void: 0x0a0a0a,
      coal: 0x121214,
      iron: 0x1e1e22,
      gunmetal: 0x34343c,
      blood: 0xc1121f,
      bloodHot: 0xff2a18,
      hellfire: 0xff6a00,
      rust: 0x8a4b2a,
      bone: 0xe9e3d6,
      ash: 0x9b958a,
      toxic: 0x8bdc1f,
    });
  });

  test("reserves toxic green for the neutral Scourge objective", () => {
    const humanEntities = [
      ...CHAMPION_IDS.map((id) => makeChampion(id)),
      makeMinion("pyre"),
      makeMinion("warden"),
      makeTower("pyre"),
      makeTower("warden"),
      makeBase("pyre"),
      makeBase("warden"),
    ];

    for (const entity of humanEntities) {
      expect(materialColors(entity.mesh)).not.toContain(COLORS.toxic);
    }
    expect(materialColors(makeScourge().mesh)).toContain(COLORS.toxic);
  });

  test("keeps Pyre and Warden champion silhouettes geometrically distinct", () => {
    const pyre = makeChampion("pyre-duelist");
    const warden = makeChampion("warden-bastion");

    expect(geometryTypes(pyre.mesh)).toContain("ConeGeometry");
    expect(geometryTypes(pyre.mesh)).not.toContain("BoxGeometry");
    expect(geometryTypes(warden.mesh)).toContain("BoxGeometry");
    expect(geometryTypes(warden.mesh)).not.toContain("ConeGeometry");
    expect(CHAMPIONS["pyre-duelist"].silhouette).not.toBe(CHAMPIONS["warden-bastion"].silhouette);
  });

  test("preserves the base-to-minion gameplay scale hierarchy", () => {
    expect(CONSTANTS.base.height).toBeGreaterThan(CONSTANTS.tower.height);
    expect(CONSTANTS.tower.height).toBeGreaterThan(CONSTANTS.champion.height);
    expect(CONSTANTS.base.radius).toBeGreaterThan(CONSTANTS.tower.radius);
    expect(CONSTANTS.tower.radius).toBeGreaterThan(CONSTANTS.champion.radius);
    expect(CONSTANTS.champion.radius).toBeGreaterThan(CONSTANTS.minion.radius);
  });
});
