import * as THREE from "three";
import { COLORS, CONSTANTS } from "../constants";

// Owns the renderer, scene, camera, lights, and the static arena geometry.
// Keeps a smoothed follow-cam locked behind the champion looking down the lane.
export class RenderSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly camTarget = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly emberLight: THREE.PointLight;
  private emberPhase = 0;

  // Top-down MOBA follow-cam tunables. The camera rides high and steeply behind
  // the champion so it reads like Dota/LoL — and stays high enough that the
  // friendly base (a tall pillar right behind the spawn) never walls off the view.
  private static readonly CAM_HEIGHT = 26; // units above the lane
  private static readonly CAM_BACK = 12; // units behind the champion (toward -Z)
  private static readonly CAM_AHEAD = 4; // look this far up-lane past the champion
  private static readonly CAM_LIFT = 1.5; // height of the look-at point
  private static readonly CAM_PAN = 0.7; // how much the cam strafes with the champion
  private static readonly CAM_SMOOTH = 7; // follow stiffness (1/sec), applied frame-rate independent

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(COLORS.void, 1);
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.void);
    // Fog pushed back so the enemy base still reads as a distant beacon.
    this.scene.fog = new THREE.Fog(COLORS.void, 48, 150);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
    // Seed the camera at the champion's spawn pose so there's no first-frame snap.
    const spawnZ = CONSTANTS.champion.respawnZ;
    this.camera.position.set(0, RenderSystem.CAM_HEIGHT, spawnZ - RenderSystem.CAM_BACK);
    this.camera.lookAt(0, RenderSystem.CAM_LIFT, spawnZ + RenderSystem.CAM_AHEAD);

    this.buildLights();
    this.buildArena();

    this.emberLight = new THREE.PointLight(COLORS.hellfire, 60, 60, 2);
    this.emberLight.position.set(0, 6, 0);
    this.scene.add(this.emberLight);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  add(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  remove(obj: THREE.Object3D): void {
    this.scene.remove(obj);
  }

  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(COLORS.iron, 1.4));
    const key = new THREE.DirectionalLight(COLORS.bone, 1.1);
    key.position.set(-12, 30, -8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(COLORS.blood, 0.6);
    rim.position.set(10, 12, 40);
    this.scene.add(rim);
  }

  private buildArena(): void {
    const { length, width } = CONSTANTS.arena;

    // Lane floor.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshStandardMaterial({
        color: COLORS.iron,
        roughness: 0.95,
        metalness: 0.1,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Hellfire center seam glowing down the lane.
    const seam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, length),
      new THREE.MeshStandardMaterial({
        color: COLORS.hellfire,
        emissive: COLORS.hellfire,
        emissiveIntensity: 0.8,
      }),
    );
    seam.rotation.x = -Math.PI / 2;
    seam.position.y = 0.02;
    this.scene.add(seam);

    // Gunmetal lane walls.
    const wallMat = new THREE.MeshStandardMaterial({
      color: COLORS.gunmetal,
      roughness: 0.6,
      metalness: 0.5,
    });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, length), wallMat);
      wall.position.set((side * width) / 2, 1.5, 0);
      this.scene.add(wall);
    }

    // Scattered rust pillars flanking the lane for depth.
    const pillarMat = new THREE.MeshStandardMaterial({
      color: COLORS.rust,
      roughness: 0.9,
      metalness: 0.2,
    });
    for (let i = 0; i < 10; i++) {
      const z = -length / 2 + 4 + i * ((length - 8) / 9);
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 5, 6), pillarMat);
        p.position.set(side * (width / 2 + 2.2), 2.5, z);
        this.scene.add(p);
      }
    }
  }

  followChampion(pos: THREE.Vector3, dt: number): void {
    // High, steep top-down chase: ride above and just behind the champion and
    // look slightly up-lane, keeping the hero centered and always in view.
    this.camTarget.set(pos.x * RenderSystem.CAM_PAN, RenderSystem.CAM_HEIGHT, pos.z - RenderSystem.CAM_BACK);
    // Exponential smoothing -> same feel at 30, 60, or 144fps.
    const alpha = 1 - Math.exp(-RenderSystem.CAM_SMOOTH * dt);
    this.camera.position.lerp(this.camTarget, alpha);
    this.lookTarget.set(pos.x * RenderSystem.CAM_PAN, RenderSystem.CAM_LIFT, pos.z + RenderSystem.CAM_AHEAD);
    this.camera.lookAt(this.lookTarget);
  }

  update(dt: number): void {
    // Flickering hellfire ember light for atmosphere.
    this.emberPhase += dt * 6;
    this.emberLight.intensity = 50 + Math.sin(this.emberPhase) * 14 + Math.random() * 6;
  }

  draw(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
}
