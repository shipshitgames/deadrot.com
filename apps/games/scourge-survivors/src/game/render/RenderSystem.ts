import { firstPersonPointerLock } from "@shipshitgames/engine";
import * as THREE from "three";
import { CAMERA_BASE_FOV } from "../constants";
import type { GameContext } from "../context";
import type { GameSystems } from "../systems";

/** Owns the renderer/scene/camera/controls bootstrap and the per-frame draw. */
export class RenderSystem {
  constructor(
    private ctx: GameContext,
    _sys: GameSystems,
  ) {}

  setupRenderer() {
    this.ctx.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.ctx.renderer.domElement.dataset.testid = "game-canvas";
    this.ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.ctx.renderer.setSize(this.ctx.container.clientWidth, this.ctx.container.clientHeight);
    this.ctx.renderer.shadowMap.enabled = true;
    this.ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.ctx.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.ctx.renderer.toneMappingExposure = 1.15;
    this.ctx.container.appendChild(this.ctx.renderer.domElement);
  }

  setupScene() {
    this.ctx.scene = new THREE.Scene();
    const bg = new THREE.Color(0x0e1320);
    this.ctx.scene.background = bg;
    this.ctx.scene.fog = new THREE.Fog(bg.getHex(), 35, 170);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_BASE_FOV,
      this.ctx.container.clientWidth / this.ctx.container.clientHeight,
      0.05,
      500,
    );
    this.ctx.rig = firstPersonPointerLock(camera, this.ctx.renderer.domElement);
    this.ctx.scene.add(camera);

    this.ctx.scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x202028, 1.1));
    this.ctx.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(38, 58, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.bias = -0.0004;
    this.ctx.scene.add(sun);
    this.ctx.scene.add(sun.target);

    // Two coloured rim lights — recoloured/repositioned per map by buildArena.
    this.ctx.accentA = new THREE.PointLight(0x00d8ff, 60, 90, 2);
    this.ctx.accentA.position.set(-28, 8, -28);
    this.ctx.scene.add(this.ctx.accentA);
    this.ctx.accentB = new THREE.PointLight(0xff4d6d, 60, 90, 2);
    this.ctx.accentB.position.set(28, 8, 28);
    this.ctx.scene.add(this.ctx.accentB);
  }

  render() {
    const cam = this.ctx.camera;
    const trauma = this.ctx.shakeTrauma * this.ctx.effectLevels.shake;
    const recoil = this.ctx.camRecoil * this.ctx.effectLevels.shake;

    // Apply screenshake + recoil as a TRANSIENT offset around the draw, then
    // restore — so the camera rig's mouse-look (which owns camera rotation) never
    // sees it and aim doesn't drift. The weapon view-model is a camera child, so
    // it rides the shake for free.
    if (trauma > 0.0005 || recoil > 0.00005 || recoil < -0.00005) {
      const px = cam.position.x;
      const py = cam.position.y;
      const pz = cam.position.z;
      const rx = cam.rotation.x;
      const rz = cam.rotation.z;

      const s = trauma * trauma; // quadratic falloff reads punchier than linear
      const posMag = 0.22 * s;
      cam.position.x += (Math.random() * 2 - 1) * posMag;
      cam.position.y += (Math.random() * 2 - 1) * posMag;
      cam.position.z += (Math.random() * 2 - 1) * posMag;
      cam.rotation.x += recoil + (Math.random() * 2 - 1) * s * 0.03;
      cam.rotation.z += (Math.random() * 2 - 1) * s * 0.045;

      this.ctx.renderer.render(this.ctx.scene, cam);

      cam.position.set(px, py, pz);
      cam.rotation.x = rx;
      cam.rotation.z = rz;
    } else {
      this.ctx.renderer.render(this.ctx.scene, cam);
    }
  }
}
