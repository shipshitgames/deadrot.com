import blockTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/block.webp";
import columnTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/column.webp";
import decalTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/decal.webp";
import floorTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/floor.webp";
import wallTextureUrl from "@shipshitgames/assets/games/warline/textures/portal-deck/wall.webp";
import type { Faction, WorldState } from "@shipshitgames/warline";
import { FACTION_COLOR, GAME_OPERATIONS, regionById } from "@shipshitgames/warline";
import * as THREE from "three";
import type { PortalDef } from "./portals";
import { PORTALS } from "./portals";

/** Numeric (0xRRGGBB) form of the shared CSS faction palette, derived once. */
const FACTION_COLOR_HEX = Object.fromEntries(
  Object.entries(FACTION_COLOR).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as Record<Faction, number>;

function accentHex(def: PortalDef): number {
  return parseInt(def.accentCss.slice(1), 16);
}

export interface PortalRuntime {
  def: PortalDef;
  group: THREE.Group;
  veil: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  light: THREE.PointLight;
  pad: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

export interface TableRegionRuntime {
  id: string;
  mat: THREE.MeshBasicMaterial;
  breach?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
}

export interface TableLaneRuntime {
  id: string;
  mat: THREE.LineBasicMaterial;
}

export function buildFrontScene(scene: THREE.Scene, state: WorldState) {
  const textureLoader = new THREE.TextureLoader();
  const colliders: THREE.Mesh[] = [];
  const portals: PortalRuntime[] = [];
  const tableRegions: TableRegionRuntime[] = [];
  const tableLanes: TableLaneRuntime[] = [];

  scene.add(new THREE.HemisphereLight(0xe9e3d6, 0x130a06, 1.25));

  const key = new THREE.DirectionalLight(0xffb36c, 2.3);
  key.position.set(-18, 26, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 90;
  scene.add(key);

  const toxic = new THREE.PointLight(0x8bdc1f, 2.2, 48, 1.8);
  toxic.position.set(20, 5, -18);
  scene.add(toxic);

  const floorTexture = makeTexture(textureLoader, floorTextureUrl, 12, 12);
  const wallTexture = makeTexture(textureLoader, wallTextureUrl, 6, 2);
  const blockTexture = makeTexture(textureLoader, blockTextureUrl, 2, 2);
  const columnTexture = makeTexture(textureLoader, columnTextureUrl, 1, 2);
  const decalTexture = makeTexture(textureLoader, decalTextureUrl, 1, 1);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0xb89274,
    roughness: 0.9,
    metalness: 0.08,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTexture,
    color: 0x8b6d5a,
    roughness: 0.66,
    metalness: 0.24,
  });
  const blockMat = new THREE.MeshStandardMaterial({
    map: blockTexture,
    color: 0x8c7667,
    roughness: 0.74,
    metalness: 0.18,
  });
  const columnMat = new THREE.MeshStandardMaterial({
    map: columnTexture,
    color: 0xa68a72,
    roughness: 0.58,
    metalness: 0.34,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(86, 86), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  addBoundaryWalls(scene, wallMat, colliders);
  addRunways(scene, PORTALS);
  const tableHolo = addCommandTable(scene, state, tableRegions, tableLanes, colliders);
  addObstacles(scene, blockMat, columnMat, colliders);
  addDecals(scene, decalTexture);

  for (const portal of PORTALS) portals.push(addPortal(scene, textureLoader, portal, colliders));

  return { colliders, portals, tableRegions, tableLanes, tableHolo, disposed: false };
}

function makeTexture(loader: THREE.TextureLoader, url: string, repeatX: number, repeatY: number) {
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function addBoundaryWalls(scene: THREE.Scene, wallMat: THREE.Material, colliders: THREE.Mesh[]) {
  const half = 43;
  const thickness = 2.8;
  const height = 5.5;
  const span = half * 2 + thickness;
  const defs: Array<[number, number, number, number]> = [
    [0, -half, span, thickness],
    [0, half, span, thickness],
    [-half, 0, thickness, span],
    [half, 0, thickness, span],
  ];
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff6a00, emissiveIntensity: 1.2 });

  for (const [x, z, w, d] of defs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wallMat);
    wall.position.set(x, height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    colliders.push(wall);

    const longX = w >= d;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(longX ? w : 0.1, 0.08, longX ? 0.1 : d), trimMat);
    trim.position.set(x, height - 0.08, z);
    scene.add(trim);
  }
}

function addRunways(scene: THREE.Scene, portals: PortalDef[]) {
  for (const portal of portals) {
    const [x, z] = portal.position;
    const length = Math.max(1, Math.hypot(x, z));
    const mat = new THREE.MeshBasicMaterial({
      color: accentHex(portal),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const runway = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, length), mat);
    runway.position.set(x / 2, 0.035, z / 2);
    runway.rotation.y = Math.atan2(x, z);
    scene.add(runway);
  }
}

function addCommandTable(
  scene: THREE.Scene,
  state: WorldState,
  regions: TableRegionRuntime[],
  lanes: TableLaneRuntime[],
  colliders: THREE.Mesh[],
): THREE.Group {
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.55, metalness: 0.48 });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    emissive: 0x2a0905,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.86,
    roughness: 0.38,
    metalness: 0.35,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.46, 3.25), baseMat);
  base.position.set(0, 0.28, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);
  colliders.push(base);

  const top = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.08, 6.25), topMat);
  top.position.set(0, 0.68, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  scene.add(top);

  const glow = new THREE.PointLight(0xff6a00, 1.2, 16, 2.1);
  glow.position.set(0, 1.85, 0);
  scene.add(glow);

  // The war map (lanes + region nodes + breaches) lives in its own group so it
  // can lift off the table into a hologram when the Command Table is engaged.
  const holo = new THREE.Group();
  scene.add(holo);

  for (const lane of state.lanes) {
    const from = regionById(state, lane.from);
    const to = regionById(state, lane.to);
    if (!from || !to) continue;
    const a = mapPointToTable(from.x, from.y);
    const b = mapPointToTable(to.x, to.y);
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, 0.78, a.z),
      new THREE.Vector3(b.x, 0.78, b.z),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: FACTION_COLOR_HEX[lane.control],
      transparent: true,
      opacity: 0.7,
    });
    holo.add(new THREE.Line(geom, mat));
    lanes.push({ id: lane.id, mat });
  }

  for (const region of state.regions) {
    const p = mapPointToTable(region.x, region.y);
    const mat = new THREE.MeshBasicMaterial({ color: FACTION_COLOR_HEX[region.faction] });
    const node = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 18), mat);
    node.position.set(p.x, 0.84, p.z);
    node.rotation.x = Math.PI / 2;
    holo.add(node);

    let breach: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | undefined;
    if (region.breachId) {
      breach = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.018, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x8bdc1f, transparent: true, opacity: 0.8 }),
      );
      breach.position.set(p.x, 0.88, p.z);
      breach.rotation.x = Math.PI / 2;
      holo.add(breach);
    }

    regions.push({ id: region.id, mat, breach });
  }

  return holo;
}

function mapPointToTable(x: number, y: number) {
  return {
    x: ((x - 50) / 100) * 8.8,
    z: ((y - 50) / 100) * 4.9,
  };
}

function addObstacles(
  scene: THREE.Scene,
  blockMat: THREE.Material,
  columnMat: THREE.Material,
  colliders: THREE.Mesh[],
) {
  const defs: Array<{ x: number; z: number; w: number; h: number; d: number; mat: THREE.Material }> = [
    { x: -15, z: 7, w: 6.5, h: 2.2, d: 3.2, mat: blockMat },
    { x: 15, z: -7, w: 6.5, h: 2.2, d: 3.2, mat: blockMat },
    { x: 18, z: 13, w: 3.2, h: 3.8, d: 3.2, mat: columnMat },
    { x: -18, z: -13, w: 3.2, h: 3.8, d: 3.2, mat: columnMat },
    { x: -7, z: 19, w: 4.2, h: 2.8, d: 3.6, mat: blockMat },
    { x: 8, z: -19, w: 4.2, h: 2.8, d: 3.6, mat: blockMat },
  ];

  for (const def of defs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), def.mat);
    mesh.position.set(def.x, def.h / 2, def.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push(mesh);
  }
}

function addDecals(scene: THREE.Scene, texture: THREE.Texture) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xff6a00,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const spots: Array<[number, number, number, number, number]> = [
    [-18, 21, 8, 10, 0.4],
    [19, -20, 9, 8, -0.2],
    [3, 14, 10, 6, 1.2],
    [-4, -16, 8, 9, -0.9],
  ];
  for (const [x, z, w, d, r] of spots) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.clone());
    decal.position.set(x, 0.045, z);
    decal.rotation.set(-Math.PI / 2, 0, r);
    scene.add(decal);
  }
}

function addPortal(
  scene: THREE.Scene,
  loader: THREE.TextureLoader,
  def: PortalDef,
  colliders: THREE.Mesh[],
): PortalRuntime {
  const accent = accentHex(def);
  const group = new THREE.Group();
  const [x, z] = def.position;
  group.position.set(x, 0, z);
  group.rotation.y = Math.atan2(-x, -z);

  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.6,
    roughness: 0.34,
    metalness: 0.24,
  });

  const body = makeSpritePlane(loader, def.spriteUrl, def.spriteScale, 0.16);
  body.position.set(0, def.spriteY, 0);
  body.renderOrder = 2;
  group.add(body);

  const colliderMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.25, 0.8), colliderMat);
  left.position.set(-1.55, 1.65, 0);
  const right = left.clone();
  right.position.x = 1.45;
  group.add(left, right);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.08, 12, 54), glow);
  ring.position.set(0, 1.85, 0.08);
  group.add(ring);

  const veil = new THREE.Mesh(
    new THREE.CircleGeometry(1.08, 48),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  veil.position.set(0, 1.85, 0);
  group.add(veil);

  const pad = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.3, 48),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.07, 0.9);
  group.add(pad);

  const label = makeLabelSprite(def.title, GAME_OPERATIONS[def.slug].label, def.accentCss);
  label.position.set(0, def.spriteY + def.spriteScale[1] / 2 + 0.7, 0);
  group.add(label);

  const light = new THREE.PointLight(accent, 2.4, 17, 1.6);
  light.position.set(0, 2.2, 1.1);
  group.add(light);

  scene.add(group);
  group.updateWorldMatrix(true, true);
  colliders.push(left, right);
  return { def, group, veil, ring, light, pad };
}

function makeSpritePlane(loader: THREE.TextureLoader, url: string, scale: [number, number], alphaTest = 0.1) {
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(scale[0], scale[1]), material);
}

function makeLabelSprite(title: string, subtitle: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10,10,10,0.82)";
  ctx.fillRect(18, 22, 476, 128);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 22, 476, 128);
  ctx.fillStyle = "#e9e3d6";
  ctx.font = "700 34px Oswald, Arial Narrow, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title.toUpperCase(), 256, 78);
  ctx.fillStyle = accent;
  ctx.font = "700 20px monospace";
  ctx.fillText(subtitle.toUpperCase(), 256, 116);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6.8, 2.55, 1);
  return sprite;
}

export function updateDynamicScene(runtime: ReturnType<typeof buildFrontScene>, state: WorldState, time: number) {
  const breachesById = new Map(state.breaches.map((breach) => [breach.id, breach]));
  const lanesById = new Map(state.lanes.map((lane) => [lane.id, lane]));

  for (const portal of runtime.portals) {
    const region = regionById(state, portal.def.regionId);
    const heat = region ? Math.max(0, Math.min(1, region.pressure / 100)) : 0.4;
    const pulse = 0.5 + 0.5 * Math.sin(time * (2.2 + heat));
    portal.veil.material.opacity = 0.16 + heat * 0.3 + pulse * 0.08;
    portal.ring.material.emissiveIntensity = 1.1 + heat * 1.8 + pulse * 0.8;
    portal.light.intensity = 1.7 + heat * 2.4 + pulse * 0.7;
    portal.pad.material.opacity = 0.16 + heat * 0.18 + pulse * 0.1;
    portal.group.position.y = Math.sin(time * 1.3 + portal.def.position[0]) * 0.035;
  }

  for (const item of runtime.tableRegions) {
    const region = regionById(state, item.id);
    if (!region) continue;
    item.mat.color.setHex(region.revealed ? FACTION_COLOR_HEX[region.faction] : 0x1e1e22);
    if (item.breach) {
      const breach = region.breachId ? breachesById.get(region.breachId) : undefined;
      item.breach.visible = breach?.active ?? false;
      item.breach.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 3.5));
      item.breach.rotation.z += 0.015;
    }
  }

  for (const item of runtime.tableLanes) {
    const lane = lanesById.get(item.id);
    if (!lane) continue;
    item.mat.color.setHex(FACTION_COLOR_HEX[lane.control]);
    item.mat.opacity = 0.35 + Math.max(0.2, lane.flow / 120);
  }
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const item of material) disposeMaterial(item);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  const maybeMaps = material as THREE.Material & {
    map?: THREE.Texture;
    emissiveMap?: THREE.Texture;
    alphaMap?: THREE.Texture;
  };
  maybeMaps.map?.dispose();
  maybeMaps.emissiveMap?.dispose();
  maybeMaps.alphaMap?.dispose();
  material.dispose();
}
