import { RectBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import { ARENA_HALF, PLAYER_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from "../constants";
import type { GameContext } from "../context";
import { type ArenaMap, DEFAULT_ARENA_MATERIALS, type ObstacleMat } from "../data/maps";
import { arenaTexture, arenaTextureRepeat } from "../spriteAssets";
import type { GameSystems } from "../systems";

export interface ArenaDebugSnapshot {
  mapId: string;
  materialIds: Record<"floor" | "wall" | "block" | "column", string>;
  environmentObjectCount: number;
  silhouetteCount: number;
  decalCount: number;
  propCount: number;
  solidMeshes: number;
  raycastTargets: number;
  obstacleBoxes: number;
}

export class ArenaSystem {
  arenaObjects: THREE.Object3D[] = [];
  arenaMaterials: THREE.Material[] = [];
  arenaTextures: THREE.Texture[] = [];
  private environmentObjectCount = 0;
  private silhouetteCount = 0;
  private decalCount = 0;
  private propCount = 0;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
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
    this.ctx.solidMeshes = [];
    this.ctx.obstacleBoxes = [];
    this.ctx.rig.setColliders([]);
  }

  /** Build (or rebuild) the arena from a map definition: theme + boundary walls
   *  + interior obstacles. All campaign maps share the 80x80 footprint. */
  buildArena(map: ArenaMap) {
    this.clearArena();
    this.ctx.currentMap = map;
    this.ctx.bounds = RectBounds.square(ARENA_HALF);
    const t = map.theme;

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

    // --- floor ---
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.ctx.scene.add(floor);
    this.arenaObjects.push(floor);

    // --- boundary walls (+ neon trim) ---
    const span = ARENA_HALF * 2 + WALL_THICKNESS;
    const wallDefs: Array<[number, number, number, number]> = [
      [0, -ARENA_HALF, span, WALL_THICKNESS],
      [0, ARENA_HALF, span, WALL_THICKNESS],
      [-ARENA_HALF, 0, WALL_THICKNESS, span],
      [ARENA_HALF, 0, WALL_THICKNESS, span],
    ];
    for (const [x, z, w, d] of wallDefs) {
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
      const inwardX = !longX ? (x < 0 ? WALL_THICKNESS / 2 : -WALL_THICKNESS / 2) : 0;
      const inwardZ = longX ? (z < 0 ? WALL_THICKNESS / 2 : -WALL_THICKNESS / 2) : 0;
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
    return {
      mapId: this.ctx.currentMap.id,
      materialIds,
      environmentObjectCount: this.environmentObjectCount,
      silhouetteCount: this.silhouetteCount,
      decalCount: this.decalCount,
      propCount: this.propCount,
      solidMeshes: this.ctx.solidMeshes.length,
      raycastTargets: this.ctx.raycastTargets.length,
      obstacleBoxes: this.ctx.obstacleBoxes.length,
    };
  }

  private buildDistantEnvironment(map: ArenaMap) {
    const env = map.environment;
    const skyMat = new THREE.MeshBasicMaterial({
      color: env.skyTop,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(ARENA_HALF * 4.2, 32, 16), skyMat);
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
      new THREE.CylinderGeometry(ARENA_HALF * 2.25, ARENA_HALF * 2.25, 30, 48, 1, true),
      hazeMat,
    );
    haze.position.y = 12;
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
      new THREE.CylinderGeometry(ARENA_HALF * 2.18, ARENA_HALF * 2.18, 16, 48, 1, true),
      horizonMat,
    );
    horizon.position.y = 3.5;
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
