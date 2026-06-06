import * as THREE from "three";
import { CONSTANTS, COLORS } from "../constants";
import { cellToWorld, isPathCell, pathPoints, basePoint, boardSize } from "../board";

/**
 * RenderSystem owns the Three.js scene, camera, renderer, the static board art,
 * and the placement hover highlight. Entity meshes are added/removed by the
 * EntitySystem but live in this scene.
 */
export class RenderSystem {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  /** Invisible plane used by the InputSystem for raycasting the board. */
  readonly groundPlane: THREE.Mesh;
  /** Translucent cell shown under the cursor while building. */
  private readonly hover: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setClearColor(COLORS.void, 1);
    this.renderer.shadowMap.enabled = false;

    const { fov, position, lookAtY } = CONSTANTS.camera;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
    this.camera.position.set(position[0], position[1], position[2]);
    this.camera.lookAt(0, lookAtY, 0);

    this.scene.fog = new THREE.Fog(COLORS.void, 28, 60);

    this.buildLights();
    this.buildBoard();
    this.buildLane();
    this.buildBase();

    this.groundPlane = this.buildGroundPlane();
    this.hover = this.buildHover();

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  // ---- scene construction ---------------------------------------------------

  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0x404048, 1.1));

    const key = new THREE.DirectionalLight(COLORS.bone, 1.0);
    key.position.set(8, 20, 10);
    this.scene.add(key);

    // Hellfire rim light from the base end for that ember glow.
    const ember = new THREE.PointLight(COLORS.hellfire, 30, 30, 2);
    ember.position.set(basePoint.x, 3, basePoint.z);
    this.scene.add(ember);
  }

  private buildBoard(): void {
    const { cols, rows } = CONSTANTS.board;
    const tileGeo = new THREE.BoxGeometry(CONSTANTS.board.cell * 0.94, 0.3, CONSTANTS.board.cell * 0.94);
    const buildMat = new THREE.MeshStandardMaterial({
      color: COLORS.iron,
      roughness: 0.95,
      metalness: 0.1,
    });
    const pathMat = new THREE.MeshStandardMaterial({
      color: COLORS.gunmetal,
      roughness: 0.8,
      metalness: 0.35,
    });

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const onPath = isPathCell(c, r);
        const tile = new THREE.Mesh(tileGeo, onPath ? pathMat : buildMat);
        const p = cellToWorld(c, r);
        tile.position.set(p.x, -0.15, p.z);
        this.scene.add(tile);
      }
    }

    // Base slab under everything for a grounded silhouette.
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(boardSize.worldWidth + 1.2, 0.5, boardSize.worldDepth + 1.2),
      new THREE.MeshStandardMaterial({
        color: COLORS.coal,
        roughness: 1,
        metalness: 0.05,
      }),
    );
    slab.position.y = -0.45;
    this.scene.add(slab);
  }

  private buildLane(): void {
    // Hellfire stripe tracing the lane so the player reads the threat path.
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.hellfire,
      transparent: true,
      opacity: 0.28,
    });
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b) + CONSTANTS.board.cell * 0.5;
      const horizontal = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
      const geo = new THREE.PlaneGeometry(horizontal ? len : 0.5, horizontal ? 0.5 : len);
      const stripe = new THREE.Mesh(geo, mat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(mid.x, 0.06, mid.z);
      this.scene.add(stripe);
    }
  }

  private buildBase(): void {
    // Bone pillar with a hellfire core — the line the Wardens hold.
    const group = new THREE.Group();

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 2.2, 6),
      new THREE.MeshStandardMaterial({
        color: COLORS.bone,
        roughness: 0.7,
        metalness: 0.2,
      }),
    );
    pillar.position.y = 1.1;
    group.add(pillar);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshStandardMaterial({
        color: COLORS.hellfire,
        emissive: COLORS.hellfire,
        emissiveIntensity: 1.6,
      }),
    );
    core.position.y = 2.4;
    group.add(core);

    group.position.set(basePoint.x, 0, basePoint.z);
    group.userData.core = core;
    this.scene.add(group);
    this.base = group;
  }

  private buildGroundPlane(): THREE.Mesh {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(boardSize.worldWidth, boardSize.worldDepth),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    this.scene.add(plane);
    return plane;
  }

  private buildHover(): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.bloodHot,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CONSTANTS.board.cell * 0.9, CONSTANTS.board.cell * 0.9), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.12;
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  private base!: THREE.Group;

  // ---- per-frame ------------------------------------------------------------

  /** Show / move the hover highlight. `valid` tints it blood vs ash. */
  setHover(col: number | null, row: number | null, valid: boolean): void {
    if (col === null || row === null) {
      this.hover.visible = false;
      return;
    }
    const p = cellToWorld(col, row);
    this.hover.position.set(p.x, 0.12, p.z);
    this.hover.visible = true;
    const mat = this.hover.material as THREE.MeshBasicMaterial;
    mat.color.setHex(valid ? COLORS.hellfire : COLORS.gunmetal);
    mat.opacity = valid ? 0.5 : 0.25;
  }

  /** Pulse the base core; flash brighter when damaged this frame. */
  update(dt: number, t: number, baseHit: boolean): void {
    const core = this.base.userData.core as THREE.Mesh;
    const mat = core.material as THREE.MeshStandardMaterial;
    const pulse = 1.2 + Math.sin(t * 3) * 0.4;
    mat.emissiveIntensity = baseHit ? 4 : pulse;
    core.rotation.y += dt * 0.8;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
