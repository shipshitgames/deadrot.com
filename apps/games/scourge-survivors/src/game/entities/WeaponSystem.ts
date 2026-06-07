import * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import {
  ADS_LERP,
  BERSERK_FIRE_RATE_MULT,
  BERSERK_KNOCKBACK_MULT,
  CAMERA_BASE_FOV,
  CANNON_SPLASH_DAMAGE,
  CANNON_SPLASH_RADIUS,
  DAMAGE_BOOST_MULT,
  HEADSHOT_MULTIPLIER,
  MELEE_ARC_DOT,
  MELEE_COOLDOWN,
  MELEE_DAMAGE,
  MELEE_KNOCKBACK,
  MELEE_RANGE,
  PLAYER_HEIGHT,
  RELOAD_TIME,
  WEAPONS,
  type WeaponId,
} from "../constants";
import type { GameContext } from "../context";
import { WEAPON_VIEW_X, WEAPON_VIEW_Y, WEAPON_VIEW_Z } from "../data/internalTypes";
import { MUZZLE_FLASH_TEXTURE, WEAPON_SPRITE_CONFIG, WEAPON_SPRITE_TEXTURES } from "../spriteAssets";
import type { GameSystems } from "../systems";
import type { Enemy } from "./Enemy";

/** Per-weapon fire sound so each gun reads distinct (cannon booms, shotgun ka-chunks…). */
const SHOOT_SFX: Record<WeaponId, "shoot" | "shootSmg" | "shootSniper" | "shootShotgun" | "shootCannon"> = {
  pistol: "shoot",
  smg: "shootSmg",
  shotgun: "shootShotgun",
  cannon: "shootCannon",
  sniper: "shootSniper",
};

export class WeaponSystem {
  // Weapon view model
  weapon!: THREE.Group;
  weaponBarrel!: THREE.Mesh;
  weaponAccentMat!: THREE.MeshStandardMaterial;
  magazine!: THREE.Mesh;
  weaponSprite!: THREE.Sprite;
  weaponSpriteMat!: THREE.SpriteMaterial;
  weaponRecoil = 0;
  bobTime = 0;
  readonly magBaseY = -0.17;
  meleeCd = 0;
  meleeAnim = 0;
  private muzzleFlashBaseRotation = 0;
  private currentFov = CAMERA_BASE_FOV;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  buildWeapon() {
    this.weapon = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.5, metalness: 0.7 });
    this.weaponAccentMat = new THREE.MeshStandardMaterial({
      color: 0x00d8ff,
      emissive: 0x00aacc,
      emissiveIntensity: 1.2,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), bodyMat);
    body.position.set(0, 0, -0.1);
    this.weaponBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.45), bodyMat);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.14), bodyMat);
    grip.position.set(0, -0.16, 0.04);
    grip.rotation.x = 0.25;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.2), this.weaponAccentMat);
    sight.position.set(0, 0.12, -0.1);

    this.magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.5, metalness: 0.6 }),
    );
    this.magazine.position.set(0, this.magBaseY, -0.04);

    for (const part of [body, this.weaponBarrel, grip, sight, this.magazine]) part.visible = false;
    this.weapon.add(body, this.weaponBarrel, grip, sight, this.magazine);

    this.weaponSpriteMat = new THREE.SpriteMaterial({
      map: WEAPON_SPRITE_TEXTURES[this.ctx.activeWeapon],
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.04,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.weaponSprite = new THREE.Sprite(this.weaponSpriteMat);
    this.weaponSprite.renderOrder = 20;
    this.weapon.add(this.weaponSprite);

    this.ctx.muzzleFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: MUZZLE_FLASH_TEXTURE,
        color: 0xffffff,
        transparent: true,
        alphaTest: 0.04,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.ctx.muzzleFlash.center.set(0.68, 0.36);
    this.ctx.muzzleFlash.renderOrder = 21;
    this.ctx.muzzleFlash.visible = false;
    this.weapon.add(this.ctx.muzzleFlash);

    this.ctx.muzzleLight = new THREE.PointLight(0xffcc66, 0, 12, 2);
    this.ctx.muzzleLight.castShadow = false;
    this.weapon.add(this.ctx.muzzleLight);

    this.weapon.position.set(WEAPON_VIEW_X, WEAPON_VIEW_Y, WEAPON_VIEW_Z);
    this.ctx.rig.attach.add(this.weapon);
    this.applyWeaponModel(this.ctx.activeWeapon);
  }

  applyWeaponModel(id: WeaponId) {
    const spec = WEAPONS[id];
    this.weaponAccentMat.color.setHex(spec.accent);
    this.weaponAccentMat.emissive.setHex(spec.accent);
    // anchor the barrel at the front of the body and extend it forward by barrelLen
    this.weaponBarrel.scale.z = spec.barrelLen / 0.45;
    this.weaponBarrel.position.set(0, 0.02, -0.2 - spec.barrelLen / 2);

    const sprite = WEAPON_SPRITE_CONFIG[id];
    this.weaponSpriteMat.map = WEAPON_SPRITE_TEXTURES[id];
    this.weaponSpriteMat.needsUpdate = true;
    this.weaponSprite.scale.set(sprite.scale[0], sprite.scale[1], 1);
    this.weaponSprite.position.set(sprite.offset[0], sprite.offset[1], sprite.offset[2]);
    this.ctx.muzzleFlash.position.set(sprite.muzzle[0], sprite.muzzle[1], sprite.muzzle[2]);
    this.ctx.muzzleFlash.scale.setScalar(sprite.flashScale);
    this.muzzleFlashBaseRotation = sprite.flashRotation ?? 0;
    this.ctx.muzzleFlash.material.rotation = this.muzzleFlashBaseRotation;
    this.ctx.muzzleLight.position.set(sprite.muzzle[0], sprite.muzzle[1], sprite.muzzle[2]);
  }

  unlockWeapon(id: WeaponId) {
    if (!this.ctx.unlocked.has(id)) {
      this.ctx.unlocked.add(id);
      this.ctx.weaponMag[id] = WEAPONS[id].magazineSize;
      this.ctx.weaponReserve[id] = WEAPONS[id].reserve;
    } else {
      // already owned -> top it up
      this.ctx.weaponReserve[id] = Math.min(WEAPONS[id].reserveCap, this.ctx.weaponReserve[id] + WEAPONS[id].reserve);
    }
    this.switchWeapon(id);
  }

  switchWeapon(id: WeaponId) {
    if (!this.ctx.unlocked.has(id) || id === this.ctx.activeWeapon) return;
    // stash current
    this.ctx.weaponMag[this.ctx.activeWeapon] = this.ctx.ammo;
    this.ctx.weaponReserve[this.ctx.activeWeapon] = this.ctx.reserve;
    this.ctx.activeWeapon = id;
    this.ctx.ammo = this.ctx.weaponMag[id];
    this.ctx.reserve = this.ctx.weaponReserve[id];
    this.ctx.reloading = false;
    this.ctx.reloadTimer = 0;
    this.ctx.fireCooldown = 0.05;
    this.ctx.triggerQueued = false;
    this.ctx.adsZoomIndex = Math.min(this.ctx.adsZoomIndex, Math.max(0, WEAPONS[id].adsFovs.length - 1));
    this.applyWeaponModel(id);
    audio.sfx("switch");
    this.sys.hud.emit();
  }

  startAds() {
    if (this.ctx.status !== "playing") return;
    this.ctx.aimingDownSights = true;
    this.sys.hud.emit();
  }

  stopAds() {
    if (!this.ctx.aimingDownSights) return;
    this.ctx.aimingDownSights = false;
    this.sys.hud.emit();
  }

  cycleAdsZoom(direction = 1) {
    const levels = WEAPONS[this.ctx.activeWeapon].adsFovs.length;
    if (!this.ctx.aimingDownSights || levels <= 1) return;
    this.ctx.adsZoomIndex = (this.ctx.adsZoomIndex + direction + levels) % levels;
    this.sys.hud.showToast(`ZOOM ${this.ctx.adsZoomIndex + 1}`);
    this.sys.hud.emit();
  }

  tryMelee() {
    if (this.ctx.status !== "playing" || this.meleeCd > 0) return;
    this.stopAds();
    this.doMelee();
  }

  /** Knife swing: always available (no ammo). Hits a frontal cluster of enemies. */
  doMelee() {
    const berserkMul = this.ctx.damageBoostTimer > 0 ? BERSERK_FIRE_RATE_MULT : 1;
    this.meleeCd = MELEE_COOLDOWN / berserkMul;
    this.meleeAnim = 0.22;
    audio.sfx("hit");

    this.ctx._fwd.set(0, 0, -1).applyQuaternion(this.ctx.rig.facing);
    const flen = Math.hypot(this.ctx._fwd.x, this.ctx._fwd.z) || 1;
    const dirX = this.ctx._fwd.x / flen;
    const dirZ = this.ctx._fwd.z / flen;
    const px = this.ctx.body.position.x;
    const pz = this.ctx.body.position.z;
    const dmgMul = (this.ctx.damageBoostTimer > 0 ? DAMAGE_BOOST_MULT : 1) * this.ctx.statDamageMul;
    const knockbackMul = this.ctx.damageBoostTimer > 0 ? BERSERK_KNOCKBACK_MULT : 1;
    let hitAny = false;

    for (const enemy of this.ctx.enemies) {
      if (!enemy.alive) continue;
      const ex = enemy.position.x - px;
      const ez = enemy.position.z - pz;
      const d = Math.hypot(ex, ez);
      if (d > MELEE_RANGE + enemy.radius) continue;
      if (d > 0.0001 && (ex * dirX + ez * dirZ) / d < MELEE_ARC_DOT) continue;
      const crit = this.ctx.statCrit > 0 && Math.random() < this.ctx.statCrit ? 2 : 1;
      const dmg = MELEE_DAMAGE * dmgMul * crit;
      const res = enemy.takeDamage(dmg, false, MELEE_KNOCKBACK * knockbackMul, dirX, dirZ);
      hitAny = true;
      this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.6), dmg, crit > 1 ? "crit" : "normal");
      this.sys.fx.spawnBloodHit(enemy.position.clone().setY(1.45), false);
      if (res.died) this.sys.pve.onEnemyDeath(enemy, false);
    }

    if (this.ctx.multiplayer && this.sys.multiplayer.net) {
      for (const r of this.sys.multiplayer.remotePlayers.values()) {
        const rx = r.group.position.x - px;
        const rz = r.group.position.z - pz;
        const d = Math.hypot(rx, rz);
        if (d > MELEE_RANGE + 0.6) continue;
        if (d > 0.0001 && (rx * dirX + rz * dirZ) / d < MELEE_ARC_DOT) continue;
        this.sys.multiplayer.net.sendHit(r.id, MELEE_DAMAGE * dmgMul);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.sys.hud.hitMarkerSeq++;
      this.sys.fx.addShake(0.14);
    }
    this.sys.hud.emit();
  }

  shoot() {
    const spec = WEAPONS[this.ctx.activeWeapon];
    const berserkActive = this.ctx.damageBoostTimer > 0;
    this.ctx.ammo--; // magazine depletes in every mode (Survivors has infinite reserve, not infinite mag)
    const fireRateMul = this.ctx.statFireRateMul * (berserkActive ? BERSERK_FIRE_RATE_MULT : 1);
    this.ctx.fireCooldown = spec.fireInterval / fireRateMul;
    this.weaponRecoil = Math.min(
      berserkActive ? 0.2 : 0.16,
      this.weaponRecoil + (spec.pellets > 1 ? 0.12 : 0.05) * (berserkActive ? 1.18 : 1),
    );
    audio.sfx(SHOOT_SFX[this.ctx.activeWeapon]);
    this.sys.fx.addShake(spec.shake * (berserkActive ? 1.38 : 1));
    this.sys.fx.addRecoil(spec.kick);

    this.ctx.muzzleTimer = 0.05;
    this.ctx.muzzleFlash.visible = true;
    this.ctx.muzzleFlash.material.rotation = this.muzzleFlashBaseRotation + (Math.random() - 0.5) * 0.18;
    this.ctx.muzzleFlash.material.color.setHex(berserkActive ? 0xff2a18 : 0xffffff);
    this.ctx.muzzleFlash.scale.setScalar(
      WEAPON_SPRITE_CONFIG[this.ctx.activeWeapon].flashScale * (berserkActive ? 1.22 : 1),
    );
    this.ctx.muzzleLight.color.setHex(berserkActive ? 0xff2a18 : 0xffcc66);
    this.ctx.muzzleLight.intensity = berserkActive ? 13 : 8;

    this.ctx.scene.updateMatrixWorld();
    this.ctx.rig.pickRay(0, 0, this.ctx.raycaster);
    this.ctx._origin.copy(this.ctx.raycaster.ray.origin);
    this.ctx._fwd.copy(this.ctx.raycaster.ray.direction);
    this.ctx._right.crossVectors(this.ctx._fwd, this.ctx._worldUp).normalize();
    this.ctx._up.crossVectors(this.ctx._right, this.ctx._fwd).normalize();

    const dmgMult = (berserkActive ? DAMAGE_BOOST_MULT : 1) * this.ctx.statDamageMul;
    const knockbackMul = berserkActive ? BERSERK_KNOCKBACK_MULT : 1;
    const headshotMultiplier = spec.headshotMultiplier ?? HEADSHOT_MULTIPLIER;
    const muzzleWorld = this.ctx.muzzleFlash.getWorldPosition(new THREE.Vector3());
    const pellets = spec.pellets + (this.ctx.survivors ? this.ctx.statMultishot : 0);
    const baseSpread = pellets > 1 ? Math.max(spec.spread, 0.03) : spec.spread;
    const adsSpreadMul = 1 + (spec.adsSpreadMul - 1) * this.ctx.adsT;
    const spread = baseSpread * adsSpreadMul;
    const isCannon = this.ctx.activeWeapon === "cannon";
    const dualShots = this.ctx.dualWeaponTimer > 0 && spec.dualCompatible ? 2 : 1;
    let cannonCenter: THREE.Vector3 | null = null;

    for (let shot = 0; shot < dualShots; shot++) {
      const side = shot === 0 ? 0 : -1;
      const rayOrigin = this.ctx._origin.clone();
      const tracerOrigin = muzzleWorld.clone();
      if (side !== 0) {
        rayOrigin.addScaledVector(this.ctx._right, side * 0.22);
        tracerOrigin.addScaledVector(this.ctx._right, side * 0.38);
        tracerOrigin.addScaledVector(this.ctx._up, -0.04);
      }

      for (let p = 0; p < pellets; p++) {
        const dir = this.ctx._fwd.clone();
        if (spread > 0) {
          dir.addScaledVector(this.ctx._right, (Math.random() * 2 - 1) * spread);
          dir.addScaledVector(this.ctx._up, (Math.random() * 2 - 1) * spread);
          dir.normalize();
        }
        // horizontal knockback direction (push the enemy away from the player)
        const hk = Math.hypot(dir.x, dir.z) || 1;
        const kx = dir.x / hk;
        const kz = dir.z / hk;
        this.ctx.raycaster.set(rayOrigin, dir);
        this.ctx.raycaster.far = 500;
        const hits = this.ctx.raycaster.intersectObjects(this.ctx.raycastTargets, false);

        let endPoint: THREE.Vector3 | null = null;
        for (const h of hits) {
          const ud = h.object.userData as { enemy?: Enemy; part?: string; solid?: boolean; remoteId?: string };
          if (ud.remoteId) {
            // PvP: report the hit to the server (authoritative health/kills).
            const headshot = ud.part === "head";
            const dmg = spec.damage * dmgMult * (headshot ? headshotMultiplier : 1);
            this.sys.multiplayer.net?.sendHit(ud.remoteId, dmg);
            endPoint = h.point.clone();
            this.sys.hud.addDamageNumber(h.point, dmg, headshot ? "head" : "normal");
            if (headshot) {
              this.ctx.headshots++;
              this.sys.hud.headshotSeq++;
              audio.sfx("headshot");
            } else {
              this.sys.hud.hitMarkerSeq++;
              audio.sfx("hit");
            }
            break;
          } else if (ud.enemy) {
            if (!ud.enemy.alive) continue;
            const headshot = ud.part === "head";
            const crit = this.ctx.statCrit > 0 && Math.random() < this.ctx.statCrit ? 2 : 1;
            const dmg = spec.damage * dmgMult * crit * (headshot ? headshotMultiplier : 1);
            const res = ud.enemy.takeDamage(dmg, headshot, spec.knockback * knockbackMul, kx, kz);
            endPoint = h.point.clone();
            if (!res.blocked) {
              this.sys.hud.addDamageNumber(h.point, dmg, headshot ? "head" : crit > 1 ? "crit" : "normal");
              this.sys.fx.spawnImpactSpark(h.point, headshot ? 0xffffff : 0xfff1b5);
              this.sys.fx.spawnBloodHit(h.point, headshot);
            }
            if (res.blocked) {
              this.sys.hud.hitMarkerSeq++; // shield ping (no damage)
              audio.sfx("shieldhit");
            } else if (res.died) {
              if (headshot) {
                this.ctx.headshots++;
                this.sys.hud.headshotSeq++;
                this.sys.hud.showToast("HEADSHOT!");
                this.sys.fx.addShake(0.2);
                audio.sfx("headshot");
              }
              this.sys.pve.onEnemyDeath(ud.enemy, headshot);
            } else if (headshot) {
              this.ctx.headshots++;
              this.sys.hud.headshotSeq++;
              this.sys.fx.addShake(0.16);
              audio.sfx("headshot");
            } else {
              this.sys.hud.hitMarkerSeq++;
              audio.sfx("hit");
            }
            break;
          } else if (ud.solid) {
            endPoint = h.point.clone();
            this.sys.fx.spawnImpactSpark(h.point, 0xffd9a0);
            break;
          }
        }
        if (!endPoint) endPoint = this.ctx.raycaster.ray.at(120, new THREE.Vector3());
        if (isCannon) cannonCenter = endPoint;
        this.sys.fx.addTracer(tracerOrigin, endPoint);
      }
    }

    if (isCannon && cannonCenter) this.cannonSplash(cannonCenter, dmgMult);

    if (this.ctx.ammo <= 0) this.startReload();
    this.sys.hud.emit();
  }

  /** Cannon detonation: radial damage with linear falloff + outward shove + spectacle. */
  private cannonSplash(center: THREE.Vector3, dmgMult: number) {
    for (const enemy of this.ctx.enemies) {
      if (!enemy.alive) continue;
      const ex = enemy.position.x - center.x;
      const ez = enemy.position.z - center.z;
      const d = Math.hypot(ex, ez);
      if (d > CANNON_SPLASH_RADIUS) continue;
      const falloff = 1 - d / CANNON_SPLASH_RADIUS;
      const dmg = CANNON_SPLASH_DAMAGE * dmgMult * falloff;
      const hk = d > 0.001 ? d : 1;
      const res = enemy.takeDamage(dmg, false, 10 * falloff, ex / hk, ez / hk);
      if (!res.blocked) this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.4), dmg, "normal");
      if (!res.blocked) this.sys.fx.spawnBloodHit(enemy.position.clone().setY(1.2), false);
      if (res.died) this.sys.pve.onEnemyDeath(enemy, false);
    }
    this.sys.fx.spawnDeathPop(center.clone(), 0xff8a3b, 2.8);
    this.sys.fx.spawnImpactSpark(center.clone(), 0xffe0a0);
    this.sys.fx.addShake(0.5);
    this.sys.fx.hitstop(0.07);
  }

  startReload() {
    const spec = WEAPONS[this.ctx.activeWeapon];
    if (this.ctx.reloading || this.ctx.ammo >= spec.magazineSize) return;
    if (!this.ctx.survivors && this.ctx.reserve <= 0) return; // Survivors: reserve is infinite
    this.ctx.aimingDownSights = false;
    this.ctx.reloading = true;
    this.ctx.reloadTimer = RELOAD_TIME;
    this.ctx.firing = false;
    audio.sfx("reload");
    this.sys.hud.emit();
  }

  finishReload() {
    const spec = WEAPONS[this.ctx.activeWeapon];
    if (this.ctx.survivors) {
      this.ctx.ammo = spec.magazineSize; // infinite reserve — always tops the magazine back up
    } else {
      const need = spec.magazineSize - this.ctx.ammo;
      const taken = Math.min(need, this.ctx.reserve);
      this.ctx.ammo += taken;
      this.ctx.reserve -= taken;
    }
    this.ctx.reloading = false;
    this.magazine.position.y = this.magBaseY;
    this.weapon.rotation.set(0, 0, 0);
    this.sys.hud.emit();
  }

  tickMeleeTimers(delta: number) {
    if (this.meleeCd > 0) this.meleeCd -= delta;
    if (this.meleeAnim > 0) this.meleeAnim = Math.max(0, this.meleeAnim - delta);
  }

  tickFireReload(delta: number) {
    const spec = WEAPONS[this.ctx.activeWeapon];
    this.ctx.fireCooldown -= delta;
    if (this.ctx.reloading) {
      this.ctx.reloadTimer -= delta;
      if (this.ctx.reloadTimer <= 0) this.finishReload();
    } else if (this.ctx.ammo > 0) {
      if (spec.auto) {
        if (this.ctx.firing && this.ctx.fireCooldown <= 0) this.shoot();
      } else if (this.ctx.triggerQueued && this.ctx.fireCooldown <= 0) {
        this.shoot();
        this.ctx.triggerQueued = false;
      }
    } else if (this.ctx.firing || this.ctx.triggerQueued) {
      this.ctx.triggerQueued = false;
      this.startReload();
    }
  }

  updateWeapon(delta: number) {
    this.updateAds(delta);

    if (this.meleeAnim > 0) {
      // quick knife swipe (takes priority over reload/idle pose)
      const t = 1 - this.meleeAnim / 0.22;
      const slash = Math.sin(Math.min(1, t) * Math.PI);
      this.weapon.position.set(
        WEAPON_VIEW_X - slash * 0.12,
        WEAPON_VIEW_Y + slash * 0.06,
        WEAPON_VIEW_Z - slash * 0.18,
      );
      this.weapon.rotation.set(-slash * 0.5, slash * 0.7, -slash * 0.9);
      this.weaponSpriteMat.opacity = 1;
      return;
    }
    if (this.ctx.reloading) {
      const p = 1 - this.ctx.reloadTimer / RELOAD_TIME;
      const dip = Math.sin(Math.min(1, p) * Math.PI);
      this.weapon.position.set(WEAPON_VIEW_X + dip * 0.03, WEAPON_VIEW_Y - dip * 0.22, WEAPON_VIEW_Z + dip * 0.08);
      this.weapon.rotation.set(-dip * 0.45, dip * 0.24, dip * 0.2);
      const magOut = p < 0.5 ? p * 2 : (1 - p) * 2;
      this.magazine.position.y = this.magBaseY - magOut * 0.28;
      this.weaponSpriteMat.opacity = 0.72 + (1 - dip) * 0.28;
      this.weaponRecoil = 0;
      return;
    }

    this.weaponRecoil = Math.max(0, this.weaponRecoil - delta * 0.5);
    this.magazine.position.y = this.magBaseY;
    this.weaponSpriteMat.opacity = 1;
    const berserkActive = this.ctx.damageBoostTimer > 0;
    this.weaponSpriteMat.color.setHex(berserkActive ? 0xffd1c2 : 0xffffff);
    this.ctx.muzzleFlash.material.color.setHex(berserkActive ? 0xff2a18 : 0xffffff);

    const moving =
      (this.ctx.move.forward || this.ctx.move.back || this.ctx.move.left || this.ctx.move.right) && this.ctx.canJump;
    const crouched = this.ctx.wantsCrouch || this.ctx.stanceHeight < PLAYER_HEIGHT - 0.08;
    const sprinting = moving && this.ctx.wantsSprint && !crouched;
    const bobRate = sprinting ? 13 : crouched ? 5.5 : 9;
    const bobScale = sprinting ? 1.45 : crouched ? 0.45 : 1;
    if (moving) this.bobTime += delta * bobRate;
    const bobX = moving ? Math.cos(this.bobTime) * 0.008 * bobScale : 0;
    const bobY = moving ? Math.abs(Math.sin(this.bobTime)) * 0.01 * bobScale : 0;
    const stanceDip = (PLAYER_HEIGHT - this.ctx.stanceHeight) * 0.12;
    const ads = this.ctx.adsT;
    const adsX = WEAPON_VIEW_X * (1 - 0.72 * ads);
    const adsY = WEAPON_VIEW_Y + 0.08 * ads;
    const adsZ = WEAPON_VIEW_Z - 0.04 * ads;
    this.weapon.position.set(
      adsX + bobX * (1 - ads * 0.8) + (berserkActive ? Math.sin(this.bobTime * 2.7) * 0.012 : 0),
      adsY + bobY * (1 - ads * 0.8) - stanceDip + (berserkActive ? Math.cos(this.bobTime * 3.1) * 0.008 : 0),
      adsZ + this.weaponRecoil * (0.65 - ads * 0.28),
    );
    this.weapon.rotation.set(
      -this.weaponRecoil * (1.45 - ads * 0.55),
      berserkActive ? Math.sin(this.bobTime * 2.2) * 0.035 : 0,
      this.weaponRecoil * 0.25 + (berserkActive ? Math.cos(this.bobTime * 2.6) * 0.025 : 0),
    );
  }

  private updateAds(delta: number) {
    const spec = WEAPONS[this.ctx.activeWeapon];
    const target = this.ctx.aimingDownSights && this.ctx.status === "playing" ? 1 : 0;
    const k = Math.min(1, ADS_LERP * delta);
    this.ctx.adsT += (target - this.ctx.adsT) * k;
    if (Math.abs(this.ctx.adsT - target) < 0.001) this.ctx.adsT = target;

    const zoomIndex = Math.min(this.ctx.adsZoomIndex, Math.max(0, spec.adsFovs.length - 1));
    if (zoomIndex !== this.ctx.adsZoomIndex) this.ctx.adsZoomIndex = zoomIndex;
    const targetFov = spec.adsFovs[zoomIndex] ?? CAMERA_BASE_FOV;
    const fov = CAMERA_BASE_FOV + (targetFov - CAMERA_BASE_FOV) * this.ctx.adsT;
    if (Math.abs(this.currentFov - fov) > 0.02) {
      this.currentFov = fov;
      this.ctx.rig.setFov(fov);
    }
  }

  resetView() {
    if (this.weapon) {
      this.weapon.position.set(WEAPON_VIEW_X, WEAPON_VIEW_Y, WEAPON_VIEW_Z);
      this.weapon.rotation.set(0, 0, 0);
      this.weaponSpriteMat.opacity = 1;
      this.weaponSpriteMat.color.setHex(0xffffff);
      this.magazine.position.y = this.magBaseY;
      this.ctx.aimingDownSights = false;
      this.ctx.adsT = 0;
      this.ctx.adsZoomIndex = 0;
      this.currentFov = CAMERA_BASE_FOV;
      this.ctx.rig.setFov(CAMERA_BASE_FOV);
      this.applyWeaponModel(this.ctx.activeWeapon);
    }
  }
}
