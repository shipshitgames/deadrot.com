import { anchorsOfKind, type BiomeId, flattenObstacles } from "@deadrot/game-kit/maps";
import { makeBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import { PLAYER_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from "../constants";
import type { GameContext } from "../context";
import {
  type ArenaMap,
  DEFAULT_ARENA_BOUNDS,
  DEFAULT_ARENA_MATERIALS,
  type NormalizedArenaMap,
  type ObstacleMat,
} from "../data/maps";
import { arenaTexture, arenaTextureRepeat } from "../spriteAssets";
import type { GameSystems } from "../systems";

/** Live-scene theme readback (#80): every field is read back from the scene,
 *  fog, material, and light objects — never echoed from map data — so e2e can
 *  prove the biome actually landed on the renderer. */
export interface ArenaThemeSnapshot {
  bg: number;
  fogNear: number;
  fogFar: number;
  floorTint: number;
  wallTint: number;
  trim: number;
  accentA: { color: number; x: number; y: number; z: number };
  accentB: { color: number; x: number; y: number; z: number };
}

export interface ArenaDebugSnapshot {
  mapId: string;
  /** Biome preset id of the current map (#80) — presentation-only identity. */
  biomeId: BiomeId;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  materialIds: Record<"floor" | "wall" | "block" | "column", string>;
  environmentObjectCount: number;
  silhouetteCount: number;
  decalCount: number;
  propCount: number;
  solidMeshes: number;
  raycastTargets: number;
  obstacleBoxes: number;
  /** Live theme readback — null until buildArena has dressed a scene (and after
   *  clearArena tears one down without a rebuild). */
  theme: ArenaThemeSnapshot | null;
  /** v2 adapter observability — null when the current map has no normalized layout.
   *  Field names are the contract #82's e2e extends. */
  layout: {
    rooms: number;
    levels: number;
    ramps: number;
    platforms: number;
    flattenedObstacles: number;
    anchors: { playerSpawn: number; breachSpawn: number; objective: number; extraction: number };
  } | null;
}

export class ArenaSystem {
  arenaObjects: THREE.Object3D[] = [];
  arenaMaterials: THREE.Material[] = [];
  arenaTextures: THREE.Texture[] = [];
  private environmentObjectCount = 0;
  private silhouetteCount = 0;
  private decalCount = 0;
  private propCount = 0;
  // Live refs to the three themed materials so debugSnapshot reads colours off
  // the actual scene (#80), not the map data. Null between builds.
  private floorMat: THREE.MeshStandardMaterial | null = null;
  private wallMat: THREE.MeshStandardMaterial | null = null;
  private trimMat: THREE.MeshStandardMaterial | null = null;

  constructor(
    private ctx: GameContext,
    _sys: GameSystems,
  ) {}

  /** Tear down the current arena (meshes, materials, textures) so a new map can
   *  be built in its place. Leaves enemies, pickups, and the player untouched. */
  clearArena() {
    for (const o of this.arenaObjects) {
      this.ctx.scene.remove(o);
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    }
    for (const m of this.arenaMaterials) m.dispose();
    for (const t of this.arenaTextures) t.dispose();
    // Strip the old arena solids from the shooting targets, keeping enemy hit
    // meshes (solidMeshes only ever holds arena geometry).
    if (this.ctx.solidMeshes.length) {
      const solidSet = new Set<THREE.Object3D>(this.ctx.solidMeshes);
      this.ctx.raycastTargets = this.ctx.raycastTargets.filter((o) => !solidSet.has(o));
    }
    this.arenaObjects = [];
    this.arenaMaterials = [];
    this.arenaTextures = [];
    this.environmentObjectCount = 0;
    this.silhouetteCount = 0;
    this.decalCount = 0;
    this.propCount = 0;
    this.floorMat = null;
    this.wallMat = null;
    this.trimMat = null;
    this.ctx.solidMeshes = [];
    this.ctx.obstacleBoxes = [];
    this.ctx.rig.setColliders([]);
  }

  /** Build (or rebuild) the arena from a registry-normalized map: resolved
   *  biome theme + boundary walls + interior obstacles. Maps default to the
   *  80x80 FPS footprint and may opt into custom bounds. */
  buildArena(map: NormalizedArenaMap) {
    this.clearArena();
    this.ctx.currentMap = map;
    this.ctx.bounds = makeBounds(map.bounds ?? DEFAULT_ARENA_BOUNDS);
    const t = map.theme;
    const bounds = this.ctx.bounds;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const centerX = bounds.minX + width / 2;
    const centerZ = bounds.minZ + depth / 2;

    // --- theme: background, fog, rim lights ---
    const bg = new THREE.Color(t.bg);
    this.ctx.scene.background = bg;
    if (this.ctx.scene.fog instanceof THREE.Fog) {
      this.ctx.scene.fog.color.copy(bg);
      this.ctx.scene.fog.near = t.fogNear;
      this.ctx.scene.fog.far = t.fogFar;
    } else {
      this.ctx.scene.fog = new THREE.Fog(bg.getHex(), t.fogNear, t.fogFar);
    }
    this.ctx.accentA.color.setHex(t.accentA.color);
    this.ctx.accentA.position.set(t.accentA.x, t.accentA.y, t.accentA.z);
    this.ctx.accentB.color.setHex(t.accentB.color);
    this.ctx.accentB.position.set(t.accentB.x, t.accentB.y, t.accentB.z);
    this.buildDistantEnvironment(map);

    // --- materials ---
    const textures = map.materials ?? DEFAULT_ARENA_MATERIALS;
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.makeTexture(textures.floor),
      color: t.floorTint,
      roughness: 0.9,
      metalness: 0.08,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.makeTexture(textures.wall),
      color: t.wallTint,
      roughness: 0.65,
      metalness: 0.22,
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: t.trim, emissive: t.trim, emissiveIntensity: 1.4 });
    const crateMat = new THREE.MeshStandardMaterial({
      map: this.makeTexture(textures.block),
      color: t.wallTint,
      roughness: 0.72,
      metalness: 0.24,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      map: this.makeTexture(textures.column),
      color: t.wallTint,
      roughness: 0.58,
      metalness: 0.32,
    });
    this.arenaMaterials.push(floorMat, wallMat, trimMat, crateMat, pillarMat);
    // Keep live refs so debugSnapshot reads tints off the scene materials (#80).
    this.floorMat = floorMat;
    this.wallMat = wallMat;
    this.trimMat = trimMat;

    // --- floor ---
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0, centerZ);
    floor.receiveShadow = true;
    this.ctx.scene.add(floor);
    this.arenaObjects.push(floor);

    // --- boundary walls (+ emissive ember trim) ---
    const spanX = width + WALL_THICKNESS;
    const spanZ = depth + WALL_THICKNESS;
    const wallDefs: Array<{
      x: number;
      z: number;
      w: number;
      d: number;
      inwardX: number;
      inwardZ: number;
    }> = [
      { x: centerX, z: bounds.minZ, w: spanX, d: WALL_THICKNESS, inwardX: 0, inwardZ: WALL_THICKNESS / 2 },
      { x: centerX, z: bounds.maxZ, w: spanX, d: WALL_THICKNESS, inwardX: 0, inwardZ: -WALL_THICKNESS / 2 },
      { x: bounds.minX, z: centerZ, w: WALL_THICKNESS, d: spanZ, inwardX: WALL_THICKNESS / 2, inwardZ: 0 },
      { x: bounds.maxX, z: centerZ, w: WALL_THICKNESS, d: spanZ, inwardX: -WALL_THICKNESS / 2, inwardZ: 0 },
    ];
    for (const { x, z, w, d, inwardX, inwardZ } of wallDefs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), wallMat);
      wall.position.set(x, WALL_HEIGHT / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.userData = { solid: true };
      this.ctx.scene.add(wall);
      this.ctx.solidMeshes.push(wall);
      this.arenaObjects.push(wall);

      const longX = w >= d;
      const trimThickness = 0.08;
      const trimDepth = 0.08;
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(longX ? w : trimDepth, trimThickness, longX ? trimDepth : d),
        trimMat,
      );
      trim.position.set(x + inwardX, WALL_HEIGHT - 0.08, z + inwardZ);
      this.ctx.scene.add(trim);
      this.arenaObjects.push(trim);
    }

    // --- interior obstacles ---
    const matFor = (m: ObstacleMat) => (m === "pillar" ? pillarMat : m === "wall" ? wallMat : crateMat);
    const groundTop = new Map<string, number>(); // tracks box-top heights so stacks sit on top
    for (const o of map.obstacles) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), matFor(o.mat));
      const key = `${o.x}:${o.z}`;
      let y = o.h / 2;
      if (o.elevated) {
        y = (groundTop.get(key) ?? 0) + o.h / 2; // rest on the box below it
      } else {
        groundTop.set(key, o.h);
      }
      mesh.position.set(o.x, y, o.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { solid: true };
      this.ctx.scene.add(mesh);
      this.ctx.solidMeshes.push(mesh);
      this.arenaObjects.push(mesh);
      // Elevated boxes are decorative silhouette — drawn + shootable, not colliders.
      if (!o.elevated) this.ctx.obstacleBoxes.push(new THREE.Box3().setFromObject(mesh));
    }
    this.buildFloorDecals(map);
    this.buildArenaProps(map);

    this.ctx.raycastTargets.push(...this.ctx.solidMeshes);
    this.ctx.rig.setColliders(this.ctx.solidMeshes);
  }

  /** Position the player at the current map's spawn, facing the arena centre. */
  placeAtSpawn() {
    const s = this.ctx.currentMap.spawn;
    this.ctx.velocity.set(0, 0, 0);
    this.ctx.canJump = false;
    // Centre spawns face into the arena (-Z); off-centre spawns face the origin.
    const centre = Math.abs(s.x) < 0.001 && Math.abs(s.z) < 0.001;
    this.ctx.rig.placeAt(s.x, PLAYER_HEIGHT, s.z, centre ? 0 : -s.x, centre ? -10 : -s.z);
  }

  debugSnapshot(): ArenaDebugSnapshot {
    const materialIds = this.ctx.currentMap.materials ?? DEFAULT_ARENA_MATERIALS;
    const bounds = this.ctx.bounds;
    const layout = this.ctx.currentMap.layout;
    return {
      mapId: this.ctx.currentMap.id,
      biomeId: this.ctx.currentMap.biomeId,
      bounds: {
        minX: bounds.minX,
        maxX: bounds.maxX,
        minZ: bounds.minZ,
        maxZ: bounds.maxZ,
      },
      materialIds,
      environmentObjectCount: this.environmentObjectCount,
      silhouetteCount: this.silhouetteCount,
      decalCount: this.decalCount,
      propCount: this.propCount,
      solidMeshes: this.ctx.solidMeshes.length,
      raycastTargets: this.ctx.raycastTargets.length,
      obstacleBoxes: this.ctx.obstacleBoxes.length,
      theme: this.liveThemeSnapshot(),
      layout: layout
        ? {
            rooms: layout.rooms.length,
            levels: layout.levels.length,
            ramps: layout.ramps.length,
            platforms: layout.platforms.length,
            flattenedObstacles: flattenObstacles(layout).length,
            anchors: {
              playerSpawn: anchorsOfKind(layout, "playerSpawn").length,
              breachSpawn: anchorsOfKind(layout, "breachSpawn").length,
              objective: anchorsOfKind(layout, "objective").length,
              extraction: anchorsOfKind(layout, "extraction").length,
            },
          }
        : null,
    };
  }

  /** Read the theme back off the LIVE scene objects (#80): scene background,
   *  scene fog, the floor/wall/trim material colours, and the two accent
   *  lights — deliberately NOT echoed from map data, so a snapshot proves what
   *  the renderer is actually showing. Null until buildArena has run. */
  private liveThemeSnapshot(): ArenaThemeSnapshot | null {
    const { scene, accentA, accentB } = this.ctx;
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    const bg = scene.background instanceof THREE.Color ? scene.background : null;
    if (!fog || !bg || !this.floorMat || !this.wallMat || !this.trimMat) return null;
    return {
      bg: bg.getHex(),
      fogNear: fog.near,
      fogFar: fog.far,
      floorTint: this.floorMat.color.getHex(),
      wallTint: this.wallMat.color.getHex(),
      trim: this.trimMat.color.getHex(),
      accentA: {
        color: accentA.color.getHex(),
        x: accentA.position.x,
        y: accentA.position.y,
        z: accentA.position.z,
      },
      accentB: {
        color: accentB.color.getHex(),
        x: accentB.position.x,
        y: accentB.position.y,
        z: accentB.position.z,
      },
    };
  }

  private buildDistantEnvironment(map: ArenaMap) {
    const env = map.environment;
    const bounds = this.ctx.bounds;
    const visualRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const skyMat = new THREE.MeshBasicMaterial({
      color: env.skyTop,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(visualRadius * 4.2, 32, 16), skyMat);
    sky.position.set(centerX, 0, centerZ);
    sky.renderOrder = -20;
    this.addEnvironmentMesh(sky, skyMat);

    const hazeMat = new THREE.MeshBasicMaterial({
      color: env.horizonHaze,
      transparent: true,
      opacity: env.horizonOpacity,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const haze = new THREE.Mesh(
      new THREE.CylinderGeometry(visualRadius * 2.25, visualRadius * 2.25, 30, 48, 1, true),
      hazeMat,
    );
    haze.position.set(centerX, 12, centerZ);
    haze.renderOrder = -18;
    this.addEnvironmentMesh(haze, hazeMat);

    const horizonMat = new THREE.MeshBasicMaterial({
      color: env.skyHorizon,
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const horizon = new THREE.Mesh(
      new THREE.CylinderGeometry(visualRadius * 2.18, visualRadius * 2.18, 16, 48, 1, true),
      horizonMat,
    );
    horizon.position.set(centerX, 3.5, centerZ);
    horizon.renderOrder = -19;
    this.addEnvironmentMesh(horizon, horizonMat);

    for (const silhouette of env.silhouettes) {
      const mat = new THREE.MeshBasicMaterial({
        color: silhouette.color,
        transparent: silhouette.opacity !== undefined && silhouette.opacity < 1,
        opacity: silhouette.opacity ?? 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(silhouette.w, silhouette.h, silhouette.d), mat);
      mesh.position.set(silhouette.x, silhouette.h / 2, silhouette.z);
      mesh.renderOrder = -10;
      this.addEnvironmentMesh(mesh, mat);
      this.silhouetteCount += 1;
    }
  }

  private buildFloorDecals(map: ArenaMap) {
    for (const decal of map.environment.decals) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.makeTexture(decal.texture),
        color: decal.color ?? 0xffffff,
        transparent: true,
        opacity: decal.opacity ?? 0.22,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(decal.w, decal.d), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = decal.rotation ?? 0;
      mesh.position.set(decal.x, 0.018, decal.z);
      mesh.renderOrder = 4;
      this.ctx.scene.add(mesh);
      this.arenaObjects.push(mesh);
      this.arenaMaterials.push(mat);
      this.decalCount += 1;
      this.environmentObjectCount += 1;
    }
  }

  private buildArenaProps(map: ArenaMap) {
    for (const prop of map.environment.props) {
      const mat = new THREE.SpriteMaterial({
        map: this.makeTexture(prop.texture),
        color: prop.color ?? 0xffffff,
        transparent: true,
        opacity: prop.opacity ?? 0.86,
        alphaTest: 0.12,
        depthWrite: false,
        fog: true,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(prop.x, prop.y ?? prop.h / 2, prop.z);
      sprite.scale.set(prop.w, prop.h, 1);
      sprite.renderOrder = 6;
      this.ctx.scene.add(sprite);
      this.arenaObjects.push(sprite);
      this.arenaMaterials.push(mat);
      this.propCount += 1;
      this.environmentObjectCount += 1;
    }
  }

  private addEnvironmentMesh(mesh: THREE.Mesh, material: THREE.Material) {
    this.ctx.scene.add(mesh);
    this.arenaObjects.push(mesh);
    this.arenaMaterials.push(material);
    this.environmentObjectCount += 1;
  }

  private makeTexture(id: string): THREE.Texture {
    const repeat = arenaTextureRepeat(id);
    return this.makeRepeatingTexture(arenaTexture(id), repeat[0], repeat[1]);
  }

  makeRepeatingTexture(source: THREE.Texture, repeatX: number, repeatY: number): THREE.Texture {
    const tex = source.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = this.ctx.renderer.capabilities.getMaxAnisotropy();
    // Texture.clone() eagerly marks the clone for upload even when TextureLoader
    // has not populated the shared image yet. Defer that upload flag until the
    // source has image data so Three does not warn during the first few frames.
    tex.version = 0;
    const markReady = (attempt = 0) => {
      const image = source.image as { complete?: boolean; width?: number; height?: number } | null;
      if (image && image.complete !== false && (image.width ?? 1) > 0 && (image.height ?? 1) > 0) {
        tex.needsUpdate = true;
        return;
      }
      if (!this.ctx.disposed && attempt < 120) window.setTimeout(() => markReady(attempt + 1), 50);
    };
    markReady();
    this.arenaTextures.push(tex); // tracked so clearArena disposes the clone (not the shared source)
    return tex;
  }

  makeGridTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a2030";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#222a3d";
    ctx.fillRect(6, 6, size - 12, size - 12);
    ctx.strokeStyle = "#3da3c4";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(90,180,210,0.35)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
