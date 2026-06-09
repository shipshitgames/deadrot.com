import * as THREE from "three";
import { COLORS, CONSTANTS, type Team } from "./constants";
import type { Entity } from "./types";

// Pure constructors for the visual + data twin of each entity. All art is
// Three.js primitives with emissive materials in the DOOM palette.

let meshSeed = 0;
function baseEntity(
  req: Pick<Entity, "kind" | "team" | "mesh" | "maxHp" | "radius"> &
    Partial<Pick<Entity, "attackRange" | "attackDamage" | "attackCooldown">>,
): Entity {
  return {
    id: meshSeed++,
    pos: new THREE.Vector3(),
    hp: req.maxHp,
    alive: true,
    cooldown: 0,
    attackRange: req.attackRange ?? 0,
    attackDamage: req.attackDamage ?? 0,
    attackCooldown: req.attackCooldown ?? 0,
    kind: req.kind,
    team: req.team,
    mesh: req.mesh,
    maxHp: req.maxHp,
    radius: req.radius,
  };
}

export function makeChampion(team: Team = "pyre"): Entity {
  const pyre = team === "pyre";
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(
      CONSTANTS.champion.radius,
      CONSTANTS.champion.height - CONSTANTS.champion.radius * 2,
      6,
      12,
    ),
    new THREE.MeshStandardMaterial({
      // Player reads as bone/hellfire; the Warden champion reads cold gunmetal/blood-hot.
      color: pyre ? COLORS.bone : COLORS.gunmetal,
      emissive: pyre ? COLORS.blood : COLORS.bloodHot,
      emissiveIntensity: pyre ? 0.35 : 0.5,
      roughness: 0.5,
      metalness: pyre ? 0.2 : 0.55,
    }),
  );
  g.add(body);

  // A crest so each champion reads at a glance: hellfire for Pyre, blood-hot for the Warden.
  const crest = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.9, 6),
    new THREE.MeshStandardMaterial({
      color: pyre ? COLORS.hellfire : COLORS.bloodHot,
      emissive: pyre ? COLORS.hellfire : COLORS.bloodHot,
      emissiveIntensity: 1.1,
    }),
  );
  crest.position.y = CONSTANTS.champion.height / 2 + 0.4;
  g.add(crest);

  return baseEntity({
    kind: "champion",
    team,
    mesh: g,
    maxHp: CONSTANTS.champion.maxHp,
    radius: CONSTANTS.champion.radius,
    attackRange: CONSTANTS.champion.attackRange,
    attackDamage: CONSTANTS.champion.attackDamage,
    attackCooldown: CONSTANTS.champion.attackCooldown,
  });
}

export function makeMinion(team: Team): Entity {
  const pyre = team === "pyre";
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshStandardMaterial({
      color: pyre ? COLORS.hellfire : COLORS.gunmetal,
      emissive: pyre ? COLORS.hellfire : COLORS.gunmetal,
      emissiveIntensity: pyre ? 0.55 : 0.15,
      roughness: 0.7,
      metalness: 0.4,
    }),
  );

  return baseEntity({
    kind: "minion",
    team,
    mesh,
    maxHp: CONSTANTS.minion.maxHp,
    radius: CONSTANTS.minion.radius,
    attackRange: CONSTANTS.minion.attackRange,
    attackDamage: CONSTANTS.minion.attackDamage,
    attackCooldown: CONSTANTS.minion.attackCooldown,
  });
}

export function makeScourge(): Entity {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(CONSTANTS.scourge.radius, 2),
    new THREE.MeshStandardMaterial({
      color: COLORS.toxic,
      emissive: COLORS.toxic,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      metalness: 0.1,
      flatShading: true,
    }),
  );

  return baseEntity({
    kind: "scourge",
    team: "neutral",
    mesh,
    maxHp: CONSTANTS.scourge.maxHp,
    radius: CONSTANTS.scourge.radius,
  });
}

export function makeBase(team: Team): Entity {
  const pyre = team === "pyre";
  const g = new THREE.Group();

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(CONSTANTS.base.radius, CONSTANTS.base.radius * 1.3, CONSTANTS.base.height, 8),
    new THREE.MeshStandardMaterial({
      color: COLORS.iron,
      emissive: pyre ? COLORS.blood : COLORS.gunmetal,
      emissiveIntensity: pyre ? 0.6 : 0.45,
      roughness: 0.6,
      metalness: 0.5,
    }),
  );
  g.add(pillar);

  // Glowing crown so each base reads as a beacon down the lane.
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(CONSTANTS.base.radius * 0.7, 12, 12),
    new THREE.MeshStandardMaterial({
      color: pyre ? COLORS.hellfire : COLORS.bloodHot,
      emissive: pyre ? COLORS.hellfire : COLORS.bloodHot,
      emissiveIntensity: 1.2,
    }),
  );
  crown.position.y = CONSTANTS.base.height / 2 + 0.5;
  g.add(crown);

  return baseEntity({
    kind: "base",
    team,
    mesh: g,
    maxHp: CONSTANTS.base.maxHp,
    radius: CONSTANTS.base.radius,
  });
}
