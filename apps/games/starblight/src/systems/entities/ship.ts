import * as THREE from "three";
import { COLORS, CONSTANTS, WORLD } from "../../game/constants";
import { clamp, lerpAngle } from "../../game/math";
import type { RenderSystem } from "../RenderSystem";
import type { Particles } from "./particles";
import { type SpriteTextures, spriteMaterial, spritePlane } from "./sprites";

// Player interceptor: mouse-flight motion, banking, thruster trail.
export class ShipController {
  ship!: THREE.Group;
  private shipVel = new THREE.Vector2(0, 0);
  private shipHeading = Math.PI / 2;
  private wasThrusting = false;
  private thrustStartBoostTimer = 0;

  private shipGeom = spritePlane("player", CONSTANTS.player.height);

  constructor(
    private readonly render: RenderSystem,
    private readonly particles: Particles,
    private readonly textures: SpriteTextures,
  ) {}

  build() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(this.shipGeom, spriteMaterial(this.textures, "player"));
    g.add(hull);

    g.position.set(0, 0, 0);
    this.ship = g;
    this.render.add(g);
  }

  reset() {
    this.ship.position.set(0, 0, 0);
    this.shipVel.set(0, 0);
    this.shipHeading = Math.PI / 2;
    this.wasThrusting = false;
    this.thrustStartBoostTimer = 0;
    this.ship.rotation.set(0, 0, 0);
  }

  /** Mouse-follow thrust: accelerate toward the cursor (or key axis), face
   *  travel, bank into turns, and trail thruster embers at speed. */
  move(aimX: number, aimY: number, keyX: number, keyY: number, dt: number, moveMul: number, accelMul: number) {
    const p = CONSTANTS.player;
    const maxSpeed = p.maxSpeed * moveMul;
    const accel = p.accel * accelMul;

    let dvx = 0;
    let dvy = 0;
    let thrust = false;
    if (keyX !== 0 || keyY !== 0) {
      dvx = keyX * maxSpeed;
      dvy = keyY * maxSpeed;
      thrust = true;
    } else {
      const tx = aimX - this.ship.position.x;
      const ty = aimY - this.ship.position.y;
      const dist = Math.hypot(tx, ty);
      if (dist > p.followDeadzone) {
        const sp = Math.min(maxSpeed, (dist / p.followDeadzone) * maxSpeed);
        dvx = (tx / dist) * sp;
        dvy = (ty / dist) * sp;
        thrust = true;
      }
    }

    if (thrust) {
      if (!this.wasThrusting) this.thrustStartBoostTimer = p.thrustStartBoostTime;
      const boost =
        this.thrustStartBoostTimer > 0
          ? 1 + p.thrustStartBoostMultiplier * (this.thrustStartBoostTimer / p.thrustStartBoostTime)
          : 1;
      let ax = dvx - this.shipVel.x;
      let ay = dvy - this.shipVel.y;
      const al = Math.hypot(ax, ay);
      const max = accel * boost * dt;
      if (al > max && al > 0) {
        ax = (ax / al) * max;
        ay = (ay / al) * max;
      }
      this.shipVel.x += ax;
      this.shipVel.y += ay;
    } else {
      const d = p.drag ** (dt * 60);
      this.shipVel.multiplyScalar(d);
    }
    this.wasThrusting = thrust;
    this.thrustStartBoostTimer = Math.max(0, this.thrustStartBoostTimer - dt);

    const sp = this.shipVel.length();
    if (sp > maxSpeed && sp > 0) this.shipVel.multiplyScalar(maxSpeed / sp);

    this.ship.position.x += this.shipVel.x * dt;
    this.ship.position.y += this.shipVel.y * dt;

    // Soft-clamp to the quarantine cage.
    const lim = WORLD.halfW - p.edgeMargin;
    if (this.ship.position.x > lim) {
      this.ship.position.x = lim;
      this.shipVel.x = Math.min(0, this.shipVel.x);
    } else if (this.ship.position.x < -lim) {
      this.ship.position.x = -lim;
      this.shipVel.x = Math.max(0, this.shipVel.x);
    }
    if (this.ship.position.y > lim) {
      this.ship.position.y = lim;
      this.shipVel.y = Math.min(0, this.shipVel.y);
    } else if (this.ship.position.y < -lim) {
      this.ship.position.y = -lim;
      this.shipVel.y = Math.max(0, this.shipVel.y);
    }

    if (sp > 0.6) {
      const target = Math.atan2(this.shipVel.y, this.shipVel.x);
      this.shipHeading = lerpAngle(this.shipHeading, target, p.headingLerp);
    }
    this.ship.rotation.z = this.shipHeading - Math.PI / 2;
    // Subtle bank: tilt the hull around its travel axis with speed.
    const bankTarget = clamp(this.shipVel.x * 0.012, -0.45, 0.45);
    this.ship.rotation.y = THREE.MathUtils.lerp(this.ship.rotation.y, bankTarget, p.bankLerp);

    if (sp > 4) this.emitTrail();
  }

  private emitTrail() {
    // A single fading hellfire quad behind the engine.
    const back = this.shipHeading + Math.PI;
    const ox = this.ship.position.x + Math.cos(back) * CONSTANTS.player.height * 0.5;
    const oy = this.ship.position.y + Math.sin(back) * CONSTANTS.player.height * 0.5;
    const { mesh, mat } = this.particles.acquire();
    mat.color.setHex(COLORS.hellfire);
    mat.opacity = 0.7;
    mat.blending = THREE.AdditiveBlending;
    mesh.geometry = this.particles.trailGeom;
    mesh.position.set(ox, oy, -0.5);
    mesh.scale.setScalar(1);
    this.particles.particles.push({
      mesh,
      vx: -this.shipVel.x * 0.25 + (Math.random() - 0.5) * 2,
      vy: -this.shipVel.y * 0.25 + (Math.random() - 0.5) * 2,
      life: CONSTANTS.fx.trailLife,
      maxLife: CONSTANTS.fx.trailLife,
    });
  }

  dispose() {
    this.render.remove(this.ship);
    this.ship.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
  }
}
