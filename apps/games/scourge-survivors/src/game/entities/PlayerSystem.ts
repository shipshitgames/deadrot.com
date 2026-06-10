import { RectScatterSpawnProvider, type SpawnPointProvider } from "@shipshitgames/engine";
import type * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import {
  BERSERK_MOVE_MULT,
  CROUCH_ACCEL_MULT,
  GRAVITY,
  GROUND_SNAP_DOWN,
  MOVE_ACCEL,
  MOVE_DAMPING,
  MOVE_STOP_EPSILON,
  PLAYER_CROUCH_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_STEP_HEIGHT,
  SPRINT_ACCEL_MULT,
  STANCE_LERP,
  STARTING_WEAPON,
  WALL_THICKNESS,
  WEAPON_ORDER,
  WEAPONS,
  type WeaponId,
} from "../constants";
import type { GameContext } from "../context";
import type { GameSystems } from "../systems";

export class PlayerSystem {
  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  /**
   * Spawn seam: scatter enemies across the arena, away from the player and clear
   * of obstacles. The arena scatter lives in the engine ({@link RectScatterSpawnProvider});
   * this just feeds it the live bounds + the FPS obstacle test.
   */
  private spawnProvider: SpawnPointProvider = new RectScatterSpawnProvider({
    bounds: () => this.ctx.bounds,
    blocked: (x, z) =>
      this.ctx.obstacleBoxes.some(
        (box) => x > box.min.x - 1.5 && x < box.max.x + 1.5 && z > box.min.z - 1.5 && z < box.max.z + 1.5,
      ),
  });

  updatePlayerMovement(delta: number) {
    this.updateStance(delta);

    this.ctx.velocity.x -= this.ctx.velocity.x * MOVE_DAMPING * delta;
    this.ctx.velocity.z -= this.ctx.velocity.z * MOVE_DAMPING * delta;
    this.ctx.velocity.y -= GRAVITY * delta;

    this.ctx._dir.z = Number(this.ctx.move.forward) - Number(this.ctx.move.back);
    this.ctx._dir.x = Number(this.ctx.move.right) - Number(this.ctx.move.left);
    this.ctx._dir.normalize();

    const crouched = this.ctx.wantsCrouch || this.ctx.stanceHeight < PLAYER_HEIGHT - 0.08;
    const sprinting = this.ctx.wantsSprint && !crouched;
    const stanceMul = crouched ? CROUCH_ACCEL_MULT : sprinting ? SPRINT_ACCEL_MULT : 1;
    const adsMoveMul = 1 + (WEAPONS[this.ctx.activeWeapon].adsMoveMul - 1) * this.ctx.adsT;
    const berserkMoveMul = this.ctx.damageBoostTimer > 0 ? BERSERK_MOVE_MULT : 1;
    const accel = MOVE_ACCEL * this.ctx.statMoveMul * berserkMoveMul * stanceMul * adsMoveMul;
    if (this.ctx.move.forward || this.ctx.move.back) this.ctx.velocity.z -= this.ctx._dir.z * accel * delta;
    if (this.ctx.move.left || this.ctx.move.right) this.ctx.velocity.x -= this.ctx._dir.x * accel * delta;

    // Snap to a dead stop below a threshold when no key is held — kills the long
    // ice-skate glide so movement reads crisp and intentional.
    const noInput = !this.ctx.move.forward && !this.ctx.move.back && !this.ctx.move.left && !this.ctx.move.right;
    if (noInput && Math.hypot(this.ctx.velocity.x, this.ctx.velocity.z) < MOVE_STOP_EPSILON) {
      this.ctx.velocity.x = 0;
      this.ctx.velocity.z = 0;
    }

    this.ctx.rig.movePlanar(-this.ctx.velocity.x * delta, -this.ctx.velocity.z * delta);
    this.ctx.body.position.y += this.ctx.velocity.y * delta;
  }

  private updateStance(delta: number) {
    const pos = this.ctx.body.position;
    const footY = pos.y - this.ctx.stanceHeight;
    const target = this.ctx.wantsCrouch || !this.hasHeadroom(pos, PLAYER_HEIGHT) ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
    const k = Math.min(1, STANCE_LERP * delta);
    this.ctx.stanceHeight += (target - this.ctx.stanceHeight) * k;
    if (Math.abs(this.ctx.stanceHeight - target) < 0.01) this.ctx.stanceHeight = target;
    pos.y = footY + this.ctx.stanceHeight;
  }

  private hasHeadroom(pos: THREE.Vector3, targetHeight: number) {
    const footY = pos.y - this.ctx.stanceHeight;
    const headY = footY + targetHeight;
    for (const box of this.ctx.obstacleBoxes) {
      if (!this.overlapsXZ(pos, box, PLAYER_RADIUS * 0.85)) continue;
      if (box.min.y < headY && box.max.y > footY + PLAYER_CROUCH_HEIGHT + 0.08) return false;
    }
    return true;
  }

  private overlapsXZ(pos: THREE.Vector3, box: THREE.Box3, radius: number) {
    return (
      pos.x > box.min.x - radius &&
      pos.x < box.max.x + radius &&
      pos.z > box.min.z - radius &&
      pos.z < box.max.z + radius
    );
  }

  private pushOutOfBoxXZ(pos: THREE.Vector3, box: THREE.Box3, radius: number) {
    const minX = box.min.x - radius;
    const maxX = box.max.x + radius;
    const minZ = box.min.z - radius;
    const maxZ = box.max.z + radius;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const dl = pos.x - minX;
      const dr = maxX - pos.x;
      const dd = pos.z - minZ;
      const du = maxZ - pos.z;
      const m = Math.min(dl, dr, dd, du);
      if (m === dl) pos.x = minX;
      else if (m === dr) pos.x = maxX;
      else if (m === dd) pos.z = minZ;
      else pos.z = maxZ;
    }
  }

  private groundUnder(pos: THREE.Vector3) {
    const footY = pos.y - this.ctx.stanceHeight;
    const snap = this.ctx.canJump ? PLAYER_STEP_HEIGHT : GROUND_SNAP_DOWN;
    let groundY = 0;
    for (const box of this.ctx.obstacleBoxes) {
      if (!this.overlapsXZ(pos, box, PLAYER_RADIUS * 0.65)) continue;
      const top = box.max.y;
      if (top > groundY && top <= footY + snap) groundY = top;
    }
    return groundY;
  }

  private pushPlayerOutOfObstacles(pos: THREE.Vector3, radius: number) {
    const footY = pos.y - this.ctx.stanceHeight;
    const headY = pos.y;
    for (const box of this.ctx.obstacleBoxes) {
      if (footY >= box.max.y - 0.12 || headY <= box.min.y + 0.05) continue;
      this.pushOutOfBoxXZ(pos, box, radius);
    }
  }

  pushOutOfObstacles(pos: THREE.Vector3, radius: number) {
    for (const box of this.ctx.obstacleBoxes) {
      this.pushOutOfBoxXZ(pos, box, radius);
    }
  }

  resolveCollisions() {
    const pos = this.ctx.body.position;
    this.ctx.bounds.clampXZ(pos, WALL_THICKNESS / 2 + PLAYER_RADIUS);
    this.pushPlayerOutOfObstacles(pos, PLAYER_RADIUS);

    const groundY = this.groundUnder(pos);
    const footY = pos.y - this.ctx.stanceHeight;
    const snap = this.ctx.canJump ? PLAYER_STEP_HEIGHT : GROUND_SNAP_DOWN;
    this.ctx.groundY = groundY;
    if (this.ctx.velocity.y <= 0 && footY <= groundY + snap) {
      this.ctx.velocity.y = 0;
      pos.y = groundY + this.ctx.stanceHeight;
      this.ctx.canJump = true;
    } else {
      this.ctx.canJump = false;
    }
  }

  damagePlayer(amount: number) {
    let healthDamage = amount;
    if (this.ctx.survivors) {
      if (this.ctx.damageGraceTimer > 0) {
        this.sys.fx.addShake(0.06);
        audio.sfx("shieldhit");
        return;
      }
      if (this.ctx.statDodge > 0 && Math.random() < this.ctx.statDodge) {
        this.ctx.damageGraceTimer = Math.max(this.ctx.damageGraceTimer, 0.12);
        this.sys.fx.addShake(0.08);
        this.sys.hud.showToast("EVADE");
        audio.sfx("dash");
        return;
      }
      const lowHealthArmor =
        this.ctx.statBastion > 0 && this.ctx.health / this.ctx.maxHealthValue <= 0.42 ? this.ctx.statBastion * 0.08 : 0;
      const armor = Math.min(0.78, this.ctx.statArmor + lowHealthArmor);
      healthDamage *= 1 - armor;
      if (this.ctx.statShield > 0) {
        const absorbed = Math.min(this.ctx.statShield, healthDamage);
        this.ctx.statShield -= absorbed;
        healthDamage -= absorbed;
      }
    }
    this.ctx.health = Math.max(this.ctx.sandbox ? 1 : 0, this.ctx.health - healthDamage);
    if (this.ctx.survivors) this.sys.survivors.onPlayerDamaged(amount, healthDamage);
    if (this.ctx.survivors && healthDamage > 0 && this.ctx.statGrace > 0) {
      this.ctx.damageGraceTimer = Math.max(this.ctx.damageGraceTimer, this.ctx.statGrace);
    }
    this.sys.hud.damageSeq++;
    this.sys.fx.addShake(Math.min(0.6, 0.18 + healthDamage * 0.02)); // bigger hits rattle harder
    audio.sfx("hurt");
    this.sys.hud.emit();
    if (!this.ctx.sandbox && this.ctx.health <= 0) this.sys.gameOver.gameOver("dead");
  }

  randomSpawnPoint(): { x: number; z: number } {
    const p = this.ctx.body.position;
    return this.spawnProvider.next({ avoidX: p.x, avoidZ: p.z });
  }

  resetPlayer(startingWeapon: WeaponId = STARTING_WEAPON) {
    this.ctx.health = PLAYER_MAX_HEALTH;
    this.ctx.score = 0;
    this.ctx.kills = 0;
    this.ctx.headshots = 0;
    this.ctx.bossKills = 0;
    this.ctx.time = 0;
    this.ctx.outcome = null;
    this.ctx.damageBoostTimer = 0;
    this.ctx.dualWeaponTimer = 0;
    this.ctx.damageGraceTimer = 0;
    this.sys.hud.clearBanner(); // drop any stale terminal banner (e.g. "DEFEAT") so it can't re-flash next run
    this.ctx.firing = false;
    this.ctx.triggerQueued = false;
    this.ctx.velocity.set(0, 0, 0);
    this.ctx.canJump = false;
    this.ctx.groundY = 0;
    this.ctx.stanceHeight = PLAYER_HEIGHT;
    this.ctx.wantsSprint = false;
    this.ctx.wantsCrouch = false;
    this.ctx.move.forward = this.ctx.move.back = this.ctx.move.left = this.ctx.move.right = false;
    this.ctx.aimingDownSights = false;
    this.ctx.adsT = 0;
    this.ctx.adsZoomIndex = 0;

    // reset arsenal
    this.ctx.unlocked = new Set<WeaponId>([startingWeapon]);
    for (const id of WEAPON_ORDER) {
      this.ctx.weaponMag[id] = WEAPONS[id].magazineSize;
      this.ctx.weaponReserve[id] = WEAPONS[id].reserve;
    }
    this.ctx.activeWeapon = startingWeapon;
    this.ctx.ammo = this.ctx.weaponMag[startingWeapon];
    this.ctx.reserve = this.ctx.weaponReserve[startingWeapon];
    this.ctx.reloading = false;
    this.ctx.reloadTimer = 0;
    this.ctx.fireCooldown = 0;

    this.sys.arena.placeAtSpawn();

    this.sys.weapon.resetView();
  }
}
