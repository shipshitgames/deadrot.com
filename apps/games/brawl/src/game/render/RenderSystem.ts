import { subscribeGlobalGameSettings } from "@shipshitgames/ui";
import * as THREE from "three";
import { ARENA_RULES, arenaCameraFocus } from "../arena";
import { ARENA } from "../constants";
import type { FighterSpec } from "../roster";
import type { FighterRenderPort, FighterVisual, RuntimeFighter } from "../runtime";
import type { GameMode, GameStatus } from "../types";

interface Spark {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

interface ThreeFighterVisual extends FighterVisual {
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
}

/** Owns Brawl's WebGL renderer, static stage, fighter visuals, camera, and FX. */
export class RenderSystem implements FighterRenderPort {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 100);
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly sparks: Spark[] = [];
  private readonly visuals = new Map<number, ThreeFighterVisual>();
  private nextVisualId = 1;
  private started = false;
  private disposed = false;
  private shake = 0;
  private camX = 0;
  private camY = 0;
  private viewHalfW = 16;
  private viewHalfH = 9;
  private particleLevel = 1;
  private shakeLevel = 1;
  private readonly unsubscribeSettings: () => void;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: import.meta.env.DEV,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color("#07080b");
    this.camera.position.set(0, 0, 24);
    this.camera.lookAt(0, 0, 0);
    this.unsubscribeSettings = subscribeGlobalGameSettings((settings) => {
      this.particleLevel = settings.effectLevels.particles;
      this.shakeLevel = settings.effectLevels.shake;
    });
  }

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.buildStage();
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  resetCamera() {
    this.camX = 0;
    this.camY = 0;
  }

  createFighterVisual(spec: FighterSpec): FighterVisual {
    const texture = this.textureLoader.load(spec.spriteUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32 }),
    );
    const visual: ThreeFighterVisual = { id: this.nextVisualId++, sprite, shadow };
    this.visuals.set(visual.id, visual);
    this.scene.add(shadow, sprite);
    return visual;
  }

  transformFighter(fighter: RuntimeFighter) {
    const visual = this.resolveVisual(fighter.visual);
    if (!visual) return;
    const height = ARENA.fighterHeight * fighter.spec.scale;
    const width = ARENA.fighterWidth * fighter.spec.scale;
    const attackLean = fighter.attack ? fighter.facing * 0.22 : 0;
    const hurtLean = fighter.hurt > 0 ? -fighter.facing * 0.16 : 0;
    visual.sprite.position.set(fighter.x + attackLean + hurtLean, ARENA.groundY + height / 2 + fighter.y, 2);
    visual.sprite.scale.set(width * fighter.facing, height, 1);
    visual.shadow.position.set(fighter.x, ARENA.groundY + 0.06, 1);
    visual.shadow.scale.set(1.25 * fighter.spec.scale, 0.22, 1);
    const material = visual.sprite.material;
    if (fighter.respawn > 0) material.opacity = Math.floor(fighter.respawn * 18) % 2 === 0 ? 0.45 : 0.95;
    else material.opacity = fighter.hurt > 0 && Math.floor(fighter.hurt * 40) % 2 === 0 ? 0.55 : 1;
    material.color.set(fighter.blocking ? "#b7ecff" : "#ffffff");
  }

  setFighterVisible(fighter: RuntimeFighter, visible: boolean) {
    const visual = this.resolveVisual(fighter.visual);
    if (!visual) return;
    visual.sprite.visible = visible;
    visual.shadow.visible = visible;
  }

  disposeFighterVisual(fighter: RuntimeFighter) {
    const visual = this.resolveVisual(fighter.visual);
    if (!visual) return;
    this.visuals.delete(visual.id);
    this.scene.remove(visual.sprite, visual.shadow);
    visual.sprite.material.map?.dispose();
    visual.sprite.material.dispose();
    visual.shadow.geometry.dispose();
    this.disposeMaterial(visual.shadow.material);
  }

  addShake(amount: number) {
    this.shake = Math.max(this.shake, amount * this.shakeLevel);
  }

  spawnSparks(x: number, y: number, color: string, count = 10) {
    const visibleCount = Math.round(count * this.particleLevel);
    for (let i = 0; i < visibleCount; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.set(x, y, 5);
      const angle = (Math.PI * 2 * i) / Math.max(1, visibleCount) + Math.random() * 0.35;
      this.sparks.push({
        mesh,
        life: 0.28 + Math.random() * 0.16,
        maxLife: 0.44,
        vx: Math.cos(angle) * (1.4 + Math.random() * 3.2),
        vy: Math.sin(angle) * (1.4 + Math.random() * 2.5),
      });
      this.scene.add(mesh);
    }
  }

  updateEffects(delta: number) {
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      if (!spark) continue;
      spark.life -= delta;
      spark.mesh.position.x += spark.vx * delta;
      spark.mesh.position.y += spark.vy * delta;
      spark.mesh.rotation.z += delta * 8;
      const material = spark.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, spark.life / spark.maxLife);
      if (spark.life <= 0) {
        this.disposeSpark(spark);
        this.sparks.splice(i, 1);
      }
    }
  }

  updateCamera(delta: number, mode: GameMode, status: GameStatus, arenaPositions: readonly { x: number; y: number }[]) {
    let focus = { x: 0, y: 0 };
    if (mode === "arena" && status !== "select" && arenaPositions.length > 0) focus = arenaCameraFocus(arenaPositions);
    const lerp = 1 - Math.exp(-ARENA_RULES.camera.lerp * delta);
    this.camX += (focus.x - this.camX) * lerp;
    this.camY += (focus.y - this.camY) * lerp;
  }

  render(mode: GameMode) {
    const zoom = mode === "arena" ? ARENA_RULES.camera.zoom : 1;
    const halfW = this.viewHalfW * zoom;
    const halfH = this.viewHalfH * zoom;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.45 : 0;
    this.shake = Math.max(0, this.shake - 0.035);
    this.camera.position.x = this.camX + shakeX;
    this.camera.position.y = this.camY + shakeY;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeSettings();
    window.removeEventListener("resize", this.resize);
    this.renderer.setAnimationLoop(null);

    for (const visual of [...this.visuals.values()]) {
      this.scene.remove(visual.sprite, visual.shadow);
      visual.sprite.material.map?.dispose();
      visual.sprite.material.dispose();
      visual.shadow.geometry.dispose();
      this.disposeMaterial(visual.shadow.material);
    }
    this.visuals.clear();
    for (const spark of this.sparks.splice(0)) this.disposeSpark(spark);

    const disposedTextures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        this.disposeMaterial(object.material, disposedTextures);
      } else if (object instanceof THREE.Sprite) {
        const map = object.material.map;
        if (map && !disposedTextures.has(map)) {
          disposedTextures.add(map);
          map.dispose();
        }
        object.material.dispose();
      }
    });
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private resolveVisual(handle: FighterVisual): ThreeFighterVisual | null {
    return this.visuals.get(handle.id) ?? null;
  }

  private disposeSpark(spark: Spark) {
    this.scene.remove(spark.mesh);
    spark.mesh.geometry.dispose();
    this.disposeMaterial(spark.mesh.material);
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[], disposedTextures = new Set<THREE.Texture>()) {
    const materials = Array.isArray(material) ? material : [material];
    for (const entry of materials) {
      for (const value of Object.values(entry)) {
        if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
          disposedTextures.add(value);
          value.dispose();
        }
      }
      entry.dispose();
    }
  }

  private buildStage() {
    const addPlane = (width: number, height: number, x: number, y: number, z: number, color: string, opacity = 1) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      return mesh;
    };

    addPlane(40, 18, 0, 0, -7, "#08090e");
    addPlane(34, 6.2, 0, -0.4, -6, "#12151d");
    addPlane(28, 1.2, 0, ARENA.groundY - 0.6, -3, "#23242b");
    addPlane(27.4, 0.1, 0, ARENA.groundY + 0.04, -2, "#e8dcc8", 0.72);
    addPlane(4.2, 7, -11.8, -0.5, -5, "#351613", 0.62);
    addPlane(4.2, 7, 11.8, -0.5, -5, "#123022", 0.62);
    for (let i = -5; i <= 5; i += 1) {
      addPlane(0.045, 1.45, i * 2, ARENA.groundY - 0.16, -1, i === 0 ? "#ff7a1a" : "#4a4b52", 0.54);
    }

    const main = ARENA_RULES.platform;
    addPlane(0.16, 2.4, main.left, ARENA.groundY - 0.5, -1, "#c1121f", 0.4);
    addPlane(0.16, 2.4, main.right, ARENA.groundY - 0.5, -1, "#c1121f", 0.4);
    for (const side of ARENA_RULES.sidePlatforms) {
      const width = side.right - side.left;
      const cx = (side.left + side.right) / 2;
      addPlane(width, 0.32, cx, ARENA.groundY + side.top, -1.5, "#2c3340", 0.55);
      addPlane(width, 0.08, cx, ARENA.groundY + side.top + 0.16, -1.5, "#8bdc1f", 0.4);
    }
  }

  private readonly resize = () => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    const visibleHeight = 12;
    const visibleWidth = visibleHeight * (width / height);
    this.viewHalfH = visibleHeight / 2;
    this.viewHalfW = visibleWidth / 2;
    this.camera.left = -this.viewHalfW;
    this.camera.right = this.viewHalfW;
    this.camera.top = this.viewHalfH;
    this.camera.bottom = -this.viewHalfH;
    this.camera.updateProjectionMatrix();
  };
}
