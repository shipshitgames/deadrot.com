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
  DRY_FIRE_INTERVAL,
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
import { type MainWeaponVisualTier, mainWeaponTierDamageMul, mainWeaponTierIndex } from "../data/survivors";
import { dualWeaponViewActive } from "../data/weaponView";
import {
  createWeaponPose,
  evaluateWeaponPose,
  type WeaponAnimInput,
  type WeaponPose,
} from "../render/models/weaponAnimation";
import { buildWeaponViewModel, disposeWeaponViewModel, type WeaponViewModel } from "../render/models/weaponModels";
import { MUZZLE_FLASH_TEXTURE } from "../spriteAssets";
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
  // Camera-local container: procedural models are rebuilt beneath it while FX
  // sprites remain stable context-owned objects.
  weapon = new THREE.Group();
  private primaryModel: WeaponViewModel | null = null;
  private dualModel: WeaponViewModel | null = null;
  private currentModelWeapon: WeaponId | null = null;
  private currentModelTier: MainWeaponVisualTier | null = null;
  private readonly primarySlideRest = new THREE.Vector3();
  private readonly primaryMagazineRest = new THREE.Vector3();
  private readonly dualSlideRest = new THREE.Vector3();
  private readonly dualMagazineRest = new THREE.Vector3();
  private readonly muzzleWorld = new THREE.Vector3();
  private readonly dualMuzzleWorld = new THREE.Vector3();
  private readonly ejectWorld = new THREE.Vector3();
  /** Scratch for turning a raycast face normal into world space, per hit. */
  private readonly hitNormalMatrix = new THREE.Matrix3();
  private readonly hitNormal = new THREE.Vector3();
  private readonly lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private previousYaw = 0;
  private previousPitch = 0;
  private lookInitialized = false;
  private previousGrounded = true;
  private previousVerticalVelocity = 0;
  private landingVelocity = 0;
  private landingAge = 999;
  private shotCounter = 0;
  private fireAge = 999;
  private baseFov = CAMERA_BASE_FOV;
  private readonly pose: WeaponPose = createWeaponPose();
  private readonly animInput: WeaponAnimInput = {
    time: 0,
    dt: 0,
    moveSpeed: 0,
    sprinting: false,
    firing: false,
    fireAge: 999,
    shotCounter: 0,
    recoilStrength: 0,
    reloading: false,
    reloadElapsed: 0,
    reloadDuration: RELOAD_TIME,
    verticalVelocity: 0,
    grounded: true,
    landingVelocity: 0,
    landingAge: 999,
    ads: 0,
    yawDelta: 0,
    pitchDelta: 0,
    sprintBlend: 0,
    lookYaw: 0,
    lookPitch: 0,
  };
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
    this.weapon.name = "first-person-weapon";

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

    this.ctx.dualMuzzleFlash = new THREE.Sprite(this.ctx.muzzleFlash.material.clone());
    this.ctx.dualMuzzleFlash.center.set(1 - this.ctx.muzzleFlash.center.x, this.ctx.muzzleFlash.center.y);
    this.ctx.dualMuzzleFlash.renderOrder = 21;
    this.ctx.dualMuzzleFlash.visible = false;
    this.weapon.add(this.ctx.dualMuzzleFlash);

    this.ctx.muzzleLight = new THREE.PointLight(0xffcc66, 0, 12, 2);
    this.ctx.muzzleLight.castShadow = false;
    this.weapon.add(this.ctx.muzzleLight);

    this.weapon.position.set(WEAPON_VIEW_X, WEAPON_VIEW_Y, WEAPON_VIEW_Z);
    this.ctx.rig.attach.add(this.weapon);
    this.applyWeaponModel(this.ctx.activeWeapon);
  }

  /**
   * Rebuild the active procedural rig. Game/mode reset seams already call this
   * method, while updateWeapon additionally catches live survivor tier changes.
   */
  applyWeaponModel(id: WeaponId, _legacyAdsSprite = false) {
    const tier = this.activeWeaponVisualTier(id);
    if (this.currentModelWeapon === id && this.currentModelTier === tier && this.primaryModel) return;

    this.weapon.add(this.ctx.muzzleFlash, this.ctx.dualMuzzleFlash, this.ctx.muzzleLight);
    if (this.primaryModel) disposeWeaponViewModel(this.primaryModel);
    if (this.dualModel) disposeWeaponViewModel(this.dualModel);

    this.primaryModel = buildWeaponViewModel(id, tier);
    this.dualModel = WEAPONS[id].dualCompatible ? buildWeaponViewModel(id, tier) : null;
    this.weapon.add(this.primaryModel.group);
    this.primarySlideRest.copy(this.primaryModel.slide.position);
    this.primaryMagazineRest.copy(this.primaryModel.magazine.position);
    this.primaryModel.muzzle.add(this.ctx.muzzleFlash, this.ctx.muzzleLight);
    if (this.dualModel) {
      this.weapon.add(this.dualModel.group);
      this.dualSlideRest.copy(this.dualModel.slide.position);
      this.dualMagazineRest.copy(this.dualModel.magazine.position);
      this.dualModel.muzzle.add(this.ctx.dualMuzzleFlash);
    } else {
      this.weapon.add(this.ctx.dualMuzzleFlash);
    }

    const flashScale = 0.16 + WEAPONS[id].barrelLen * 0.22;
    this.ctx.muzzleFlash.position.set(0, 0, 0);
    this.ctx.dualMuzzleFlash.position.set(0, 0, 0);
    this.ctx.muzzleLight.position.set(0, 0, 0);
    this.ctx.muzzleFlash.scale.setScalar(flashScale);
    this.ctx.dualMuzzleFlash.scale.setScalar(flashScale);
    this.muzzleFlashBaseRotation = 0;
    this.ctx.muzzleFlash.material.rotation = 0;
    this.ctx.dualMuzzleFlash.visible = false;
    this.currentModelWeapon = id;
    this.currentModelTier = tier;
    this.setDualModelActive(false);
    this.resetPartTransforms();
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

  /** Cautery Cleaver swing: always available (no ammo). Hits a frontal cluster. */
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
    const dmgMul =
      (this.ctx.damageBoostTimer > 0 ? DAMAGE_BOOST_MULT : 1) *
      this.ctx.statDamageMul *
      this.ctx.warEffortDamageMul *
      mainWeaponTierDamageMul(this.activeWeaponVisualTier());
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
      const healthBefore = enemy.health;
      const res = enemy.takeDamage(dmg, false, MELEE_KNOCKBACK * knockbackMul, dirX, dirZ);
      this.sys.telemetry?.recordOutgoingDamage(enemy, "melee", dmg, res.blocked, healthBefore);
      hitAny = true;
      if (res.blocked) {
        audio.sfx("shieldhit"); // overshield ate the swing — no damage feedback
      } else {
        this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.6), dmg, crit > 1 ? "crit" : "normal");
        this.sys.fx.spawnBloodHit(enemy.position.clone().setY(1.45), false);
      }
      if (res.died) this.sys.pve.onEnemyDeath(enemy, false);
    }

    if (this.ctx.multiplayer && this.sys.multiplayer.active) {
      for (const r of this.sys.multiplayer.peers()) {
        const rx = r.group.position.x - px;
        const rz = r.group.position.z - pz;
        const d = Math.hypot(rx, rz);
        if (d > MELEE_RANGE + 0.6) continue;
        if (d > 0.0001 && (rx * dirX + rz * dirZ) / d < MELEE_ARC_DOT) continue;
        this.sys.multiplayer.sendHit(r.id, MELEE_DAMAGE * dmgMul);
        hitAny = true;
      }
    }

    if (hitAny) {
      this.sys.hud.hitSeq++;
      this.sys.fx.addShake(0.14);
    }
    this.sys.hud.emit();
  }

  shoot() {
    const spec = WEAPONS[this.ctx.activeWeapon];
    const berserkActive = this.ctx.damageBoostTimer > 0;
    const dualBonusActive = this.ctx.dualWeaponTimer > 0 && spec.dualCompatible;
    const dualVisualActive = this.dualVisualActive();
    this.ctx.ammo--; // magazine depletes in every mode (Survivors has infinite reserve, not infinite mag)
    const fireRateMul = this.ctx.statFireRateMul * (berserkActive ? BERSERK_FIRE_RATE_MULT : 1);
    this.ctx.fireCooldown = spec.fireInterval / fireRateMul;
    this.shotCounter++;
    this.fireAge = 0;
    audio.sfx(SHOOT_SFX[this.ctx.activeWeapon]);
    this.sys.fx.addShake(spec.shake * (berserkActive ? 1.38 : 1));
    this.sys.fx.addRecoil(spec.kick);

    this.ctx.muzzleTimer = 0.05;
    this.ctx.muzzleFlash.visible = true;
    this.ctx.dualMuzzleFlash.visible = dualVisualActive;
    const flashRotation = this.muzzleFlashBaseRotation + (Math.random() - 0.5) * 0.18;
    this.ctx.muzzleFlash.material.rotation = flashRotation;
    this.ctx.dualMuzzleFlash.material.rotation = -flashRotation;
    this.ctx.muzzleFlash.material.color.setHex(berserkActive ? 0xff2a18 : 0xffffff);
    this.ctx.dualMuzzleFlash.material.color.copy(this.ctx.muzzleFlash.material.color);
    const flashScale = (0.16 + spec.barrelLen * 0.22) * (berserkActive ? 1.22 : 1);
    this.ctx.muzzleFlash.scale.setScalar(flashScale);
    this.ctx.dualMuzzleFlash.scale.setScalar(flashScale);
    this.ctx.muzzleLight.color.setHex(berserkActive ? 0xff2a18 : 0xffcc66);
    this.ctx.muzzleLight.intensity = berserkActive ? 13 : 8;

    this.ctx.scene.updateMatrixWorld();
    this.ctx.rig.pickRay(0, 0, this.ctx.raycaster);
    this.ctx._origin.copy(this.ctx.raycaster.ray.origin);
    this.ctx._fwd.copy(this.ctx.raycaster.ray.direction);
    this.ctx._right.crossVectors(this.ctx._fwd, this.ctx._worldUp).normalize();
    this.ctx._up.crossVectors(this.ctx._right, this.ctx._fwd).normalize();

    // Weapon-tier power spike (#279): the same visual tier that drives the gun's
    // glow/scale also multiplies its hit damage, so climbing a tier is a real reward.
    // War-effort buff (#280) stacks multiplicatively on top.
    const dmgMult =
      (berserkActive ? DAMAGE_BOOST_MULT : 1) *
      this.ctx.statDamageMul *
      this.ctx.warEffortDamageMul *
      mainWeaponTierDamageMul(this.activeWeaponVisualTier());
    const knockbackMul = berserkActive ? BERSERK_KNOCKBACK_MULT : 1;
    const headshotMultiplier = spec.headshotMultiplier ?? HEADSHOT_MULTIPLIER;
    const muzzleWorld = this.ctx.muzzleFlash.getWorldPosition(this.muzzleWorld);
    const dualMuzzleWorld = dualVisualActive
      ? this.ctx.dualMuzzleFlash.getWorldPosition(this.dualMuzzleWorld)
      : muzzleWorld;
    const pellets = spec.pellets + (this.ctx.survivors ? this.ctx.statMultishot : 0);
    const baseSpread = pellets > 1 ? Math.max(spec.spread, 0.03) : spec.spread;
    const adsSpreadMul = 1 + (spec.adsSpreadMul - 1) * this.ctx.adsT;
    const spread = baseSpread * adsSpreadMul;
    const isCannon = this.ctx.activeWeapon === "cannon";
    const dualShots = dualBonusActive ? 2 : 1;
    let cannonCenter: THREE.Vector3 | null = null;

    for (let shot = 0; shot < dualShots; shot++) {
      const rayOrigin = this.ctx._origin.clone();
      const tracerOrigin = (shot === 0 ? muzzleWorld : dualMuzzleWorld).clone();
      if (dualBonusActive) rayOrigin.addScaledVector(this.ctx._right, shot === 0 ? -0.11 : 0.11);

      // Brass, once per trigger pull rather than per pellet — a shotgun throws
      // one hull, not eight. The cannon's drum has no case to throw.
      if (!isCannon) {
        const model = shot === 0 ? this.primaryModel : (this.dualModel ?? this.primaryModel);
        if (model) {
          this.sys.fx.spawnCasing(model.eject.getWorldPosition(this.ejectWorld), this.ctx._right, this.ctx._up);
        }
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
          const ud = h.object.userData as {
            enemy?: Enemy;
            part?: string;
            solid?: boolean;
            pane?: boolean;
            remoteId?: string;
          };
          if (ud.remoteId) {
            // PvP claim: the server validates it and owns remote health/frags.
            const headshot = ud.part === "head";
            const dmg = spec.damage * dmgMult * (headshot ? headshotMultiplier : 1);
            this.sys.multiplayer.sendHit(ud.remoteId, dmg);
            endPoint = h.point.clone();
            this.sys.hud.addDamageNumber(h.point, dmg, headshot ? "head" : "normal");
            if (headshot) {
              this.ctx.headshots++;
              this.sys.hud.emphasisSeq++;
              audio.sfx("headshot");
            } else {
              this.sys.hud.hitSeq++;
              audio.sfx("hit");
            }
            break;
          } else if (ud.enemy) {
            if (!ud.enemy.alive) continue;
            const headshot = ud.part === "head";
            const crit = this.ctx.statCrit > 0 && Math.random() < this.ctx.statCrit ? 2 : 1;
            const dmg = spec.damage * dmgMult * crit * (headshot ? headshotMultiplier : 1);
            const healthBefore = ud.enemy.health;
            const res = ud.enemy.takeDamage(dmg, headshot, spec.knockback * knockbackMul, kx, kz);
            this.sys.telemetry?.recordOutgoingDamage(ud.enemy, this.ctx.activeWeapon, dmg, res.blocked, healthBefore);
            endPoint = h.point.clone();
            if (!res.blocked) {
              this.sys.hud.addDamageNumber(h.point, dmg, headshot ? "head" : crit > 1 ? "crit" : "normal");
              this.sys.fx.spawnImpactSpark(h.point, headshot ? 0xffffff : 0xfff1b5);
              this.sys.fx.spawnBloodHit(h.point, headshot);
            }
            if (res.blocked) {
              this.sys.hud.hitSeq++; // shield ping (no damage)
              audio.sfx("shieldhit");
            } else if (res.died) {
              if (headshot) {
                this.ctx.headshots++;
                this.sys.hud.emphasisSeq++;
                this.sys.hud.showToast("HEADSHOT!");
                this.sys.fx.addShake(0.2);
                audio.sfx("headshot");
              }
              this.sys.pve.onEnemyDeath(ud.enemy, headshot);
            } else if (headshot) {
              this.ctx.headshots++;
              this.sys.hud.emphasisSeq++;
              this.sys.fx.addShake(0.16);
              audio.sfx("headshot");
            } else {
              this.sys.hud.hitSeq++;
              audio.sfx("hit");
            }
            break;
          } else if (ud.solid) {
            // Window glass shatters and lets the round carry on to whatever was
            // behind it; every other solid stops the shot here.
            if (ud.pane && this.sys.structures.shatter(h.object)) continue;
            endPoint = h.point.clone();
            // Face normals come out of the raycast in object space; the impact
            // wants world space so its spark cone opens off the real wall. A hit
            // with no face (a Sprite, a Line) just gets the undirected blip.
            let normal: THREE.Vector3 | undefined;
            if (h.face) {
              normal = this.hitNormal
                .copy(h.face.normal)
                .applyMatrix3(this.hitNormalMatrix.getNormalMatrix(h.object.matrixWorld))
                .normalize();
              // Double-sided geometry (interior walls seen from inside a
              // building) hands back a normal pointing away from the shooter.
              // Flip it so the sparks always come back out at the player.
              if (normal.dot(this.ctx.raycaster.ray.direction) > 0) normal.negate();
            }
            this.sys.fx.spawnImpactSpark(h.point, 0xffd9a0, normal);
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
      const healthBefore = enemy.health;
      const res = enemy.takeDamage(dmg, false, 10 * falloff, ex / hk, ez / hk);
      this.sys.telemetry?.recordOutgoingDamage(enemy, "cannon_splash", dmg, res.blocked, healthBefore);
      if (!res.blocked) this.sys.hud.addDamageNumber(enemy.position.clone().setY(1.4), dmg, "normal");
      if (!res.blocked) this.sys.fx.spawnBloodHit(enemy.position.clone().setY(1.2), false);
      if (res.died) this.sys.pve.onEnemyDeath(enemy, false);
    }
    // The blast is drawn at the same radius the damage loop above used, so the
    // shockwave ring lands exactly on the edge of what it hurt — the player
    // learns the cannon's footprint by watching it, not by dying to it.
    this.sys.fx.spawnExplosion(center, { radius: CANNON_SPLASH_RADIUS, shake: 0.5, hitstop: 0.07 });
    audio.sfx("explosion");
  }

  /**
   * Begin a reload, reporting whether one actually started.
   *
   * The boolean matters to {@link tickFireReload}: a refusal on an empty
   * magazine is the dry-fire moment, and the caller can only tell the
   * difference between "reloading now" and "nothing left to load" from here.
   */
  startReload(): boolean {
    const spec = WEAPONS[this.ctx.activeWeapon];
    if (this.ctx.reloading || this.ctx.ammo >= spec.magazineSize) return false;
    if (!this.ctx.survivors && this.ctx.reserve <= 0) return false; // Survivors: reserve is infinite
    this.ctx.aimingDownSights = false;
    this.ctx.reloading = true;
    this.ctx.reloadTimer = RELOAD_TIME;
    this.ctx.firing = false;
    audio.sfx("reload");
    this.sys.hud.emit();
    return true;
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
    this.resetPartTransforms();
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
      // The magazine is empty. `startReload` refuses once the reserve is gone,
      // and that refusal used to be silent: the player held the trigger on a
      // dead gun and the game answered with nothing at all, which reads as
      // broken input rather than an empty pouch. Click instead, paced by the
      // fire cooldown so holding the trigger cannot machine-gun the cue.
      if (!this.startReload() && this.ctx.fireCooldown <= 0) {
        audio.sfx("dryfire");
        this.ctx.fireCooldown = DRY_FIRE_INTERVAL;
      }
    }
  }

  updateWeapon(delta: number) {
    this.updateAds(delta);
    const tier = this.activeWeaponVisualTier();
    if (this.currentModelWeapon !== this.ctx.activeWeapon || this.currentModelTier !== tier) {
      this.applyWeaponModel(this.ctx.activeWeapon);
    }

    const dualActive = this.dualVisualActive();
    this.setDualModelActive(dualActive);
    this.updateLanding(delta);
    this.updateLookDelta();
    this.fireAge = Math.min(999, this.fireAge + Math.max(0, delta));

    const moving =
      (this.ctx.move.forward || this.ctx.move.back || this.ctx.move.left || this.ctx.move.right) && this.ctx.canJump;
    const crouched = this.ctx.wantsCrouch || this.ctx.stanceHeight < PLAYER_HEIGHT - 0.08;
    const input = this.animInput;
    input.time = this.ctx.time;
    input.dt = delta;
    input.moveSpeed = Math.hypot(this.ctx.velocity.x, this.ctx.velocity.z);
    input.sprinting = moving && this.ctx.wantsSprint && !crouched;
    input.firing = this.ctx.firing;
    input.fireAge = this.fireAge;
    input.shotCounter = this.shotCounter;
    input.recoilStrength = WEAPONS[this.ctx.activeWeapon].kick;
    input.reloading = this.ctx.reloading;
    input.reloadElapsed = this.ctx.reloading ? RELOAD_TIME - this.ctx.reloadTimer : 0;
    input.reloadDuration = RELOAD_TIME;
    input.verticalVelocity = this.ctx.velocity.y;
    input.grounded = this.ctx.canJump;
    input.landingVelocity = this.landingVelocity;
    input.landingAge = this.landingAge;
    input.ads = this.ctx.adsT;
    evaluateWeaponPose(input, this.pose);
    input.sprintBlend = this.pose.sprintBlend;
    input.lookYaw = this.pose.lookYaw;
    input.lookPitch = this.pose.lookPitch;
    this.applyPose(this.pose);

    const berserkActive = this.ctx.damageBoostTimer > 0;
    this.updateAccentMaterials(berserkActive);
    this.ctx.muzzleFlash.material.color.setHex(berserkActive ? 0xff2a18 : 0xffffff);
    this.ctx.dualMuzzleFlash.material.color.copy(this.ctx.muzzleFlash.material.color);

    if (this.meleeAnim > 0) {
      // The cleaver remains a short priority override over the additive firearm pose.
      const t = 1 - this.meleeAnim / 0.22;
      const slash = Math.sin(Math.min(1, t) * Math.PI);
      this.weapon.position.set(
        WEAPON_VIEW_X - slash * 0.12,
        WEAPON_VIEW_Y + slash * 0.06,
        WEAPON_VIEW_Z - slash * 0.18,
      );
      this.weapon.rotation.set(-slash * 0.5, slash * 0.7, -slash * 0.9);
    }

    const targetFov = this.baseFov + this.pose.fovNudge;
    if (Math.abs(this.currentFov - targetFov) > 0.02) {
      this.currentFov = targetFov;
      this.ctx.rig.setFov(targetFov);
    }
  }

  private updateAds(delta: number) {
    const spec = WEAPONS[this.ctx.activeWeapon];
    const target = this.ctx.aimingDownSights && this.ctx.status === "playing" ? 1 : 0;
    const k = 1 - Math.exp(-ADS_LERP * Math.max(0, Math.min(delta, 0.25)));
    this.ctx.adsT += (target - this.ctx.adsT) * k;
    if (Math.abs(this.ctx.adsT - target) < 0.001) this.ctx.adsT = target;

    const zoomIndex = Math.min(this.ctx.adsZoomIndex, Math.max(0, spec.adsFovs.length - 1));
    if (zoomIndex !== this.ctx.adsZoomIndex) this.ctx.adsZoomIndex = zoomIndex;
    const targetFov = spec.adsFovs[zoomIndex] ?? CAMERA_BASE_FOV;
    this.baseFov = CAMERA_BASE_FOV + (targetFov - CAMERA_BASE_FOV) * this.ctx.adsT;
  }

  private dualVisualActive(): boolean {
    const spec = WEAPONS[this.ctx.activeWeapon];
    return dualWeaponViewActive(
      this.ctx.dualWeaponTimer,
      spec.dualCompatible,
      this.dualModel !== null,
      this.ctx.adsT > 0.45,
    );
  }

  private setDualModelActive(active: boolean): void {
    const primary = this.primaryModel;
    if (!primary) return;
    primary.group.position.set(active ? -0.23 : 0, active ? -0.015 : 0, 0);
    primary.group.rotation.set(0, active ? -0.035 : 0, active ? -0.035 : 0);
    if (!this.dualModel) return;
    this.dualModel.group.visible = active;
    this.dualModel.group.position.set(0.31, -0.025, 0.015);
    this.dualModel.group.rotation.set(0, 0.045, 0.045);
  }

  private resetPartTransforms(): void {
    if (this.primaryModel) {
      this.primaryModel.slide.position.copy(this.primarySlideRest);
      this.primaryModel.magazine.position.copy(this.primaryMagazineRest);
    }
    if (this.dualModel) {
      this.dualModel.slide.position.copy(this.dualSlideRest);
      this.dualModel.magazine.position.copy(this.dualMagazineRest);
    }
  }

  private applyPose(pose: WeaponPose): void {
    const stanceDip = (PLAYER_HEIGHT - this.ctx.stanceHeight) * 0.12;
    this.weapon.position.set(
      WEAPON_VIEW_X + pose.position.x,
      WEAPON_VIEW_Y + pose.position.y - stanceDip,
      WEAPON_VIEW_Z + pose.position.z,
    );
    this.weapon.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);

    if (this.primaryModel) {
      this.primaryModel.slide.position.set(
        this.primarySlideRest.x,
        this.primarySlideRest.y,
        this.primarySlideRest.z + pose.slideOffset,
      );
      this.primaryModel.magazine.position.set(
        this.primaryMagazineRest.x + pose.magazineOffset.x,
        this.primaryMagazineRest.y + pose.magazineOffset.y,
        this.primaryMagazineRest.z + pose.magazineOffset.z,
      );
    }
    if (this.dualModel) {
      this.dualModel.slide.position.set(
        this.dualSlideRest.x,
        this.dualSlideRest.y,
        this.dualSlideRest.z + pose.slideOffset,
      );
      this.dualModel.magazine.position.set(
        this.dualMagazineRest.x + pose.magazineOffset.x,
        this.dualMagazineRest.y + pose.magazineOffset.y,
        this.dualMagazineRest.z + pose.magazineOffset.z,
      );
    }
  }

  private updateLanding(delta: number): void {
    const grounded = this.ctx.canJump;
    if (!this.previousGrounded && grounded && this.previousVerticalVelocity < -0.5) {
      this.landingVelocity = this.previousVerticalVelocity;
      this.landingAge = 0;
      // Same edge that drives the view-model dip, so the thud lands on the frame
      // the boots do. The -0.5 gate above keeps stair lips and kerbs silent; gain
      // tracks the drop so a hop off a crate is not the same weight as a rooftop.
      audio.sfx("land", { gain: Math.min(1, 0.28 + Math.abs(this.previousVerticalVelocity) / 22) });
    } else {
      this.landingAge = Math.min(999, this.landingAge + Math.max(0, delta));
    }
    if (!grounded) this.previousVerticalVelocity = this.ctx.velocity.y;
    else if (this.previousGrounded) this.previousVerticalVelocity = 0;
    this.previousGrounded = grounded;
  }

  private updateLookDelta(): void {
    this.lookEuler.setFromQuaternion(this.ctx.rig.facing, "YXZ");
    const yaw = this.lookEuler.y;
    const pitch = this.lookEuler.x;
    if (!this.lookInitialized) {
      this.previousYaw = yaw;
      this.previousPitch = pitch;
      this.lookInitialized = true;
      this.animInput.yawDelta = 0;
      this.animInput.pitchDelta = 0;
      return;
    }
    this.animInput.yawDelta = this.wrappedAngleDelta(yaw, this.previousYaw);
    this.animInput.pitchDelta = pitch - this.previousPitch;
    this.previousYaw = yaw;
    this.previousPitch = pitch;
  }

  private wrappedAngleDelta(current: number, previous: number): number {
    let delta = current - previous;
    if (delta > Math.PI) delta -= Math.PI * 2;
    else if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  private updateAccentMaterials(berserkActive: boolean): void {
    const intensity = berserkActive ? 2.5 : 1.1 + mainWeaponTierIndex(this.activeWeaponVisualTier()) * 0.22;
    if (this.primaryModel) {
      for (const material of this.primaryModel.accentMaterials) material.emissiveIntensity = intensity;
    }
    if (this.dualModel) {
      for (const material of this.dualModel.accentMaterials) material.emissiveIntensity = intensity;
    }
  }

  private activeWeaponVisualTier(id: WeaponId = this.ctx.activeWeapon): MainWeaponVisualTier {
    // The same build-power score drives damage, overall scale, tier hardware,
    // and emissive heat so visual progression remains mechanically grounded.
    void id;
    if (this.ctx.survivors) return this.sys.survivors.mainWeaponVisualTier();
    // Sandbox mirrors the game's tier rendering via a settable override (parity for testing).
    if (this.ctx.sandbox) return this.ctx.sandboxWeaponTier;
    return "base";
  }

  resetView() {
    if (this.weapon) {
      this.weapon.position.set(WEAPON_VIEW_X, WEAPON_VIEW_Y, WEAPON_VIEW_Z);
      this.weapon.rotation.set(0, 0, 0);
      this.ctx.aimingDownSights = false;
      this.ctx.adsT = 0;
      this.ctx.adsZoomIndex = 0;
      this.animInput.sprintBlend = 0;
      this.animInput.lookYaw = 0;
      this.animInput.lookPitch = 0;
      this.fireAge = 999;
      this.shotCounter = 0;
      this.landingAge = 999;
      this.landingVelocity = 0;
      this.previousGrounded = this.ctx.canJump;
      this.previousVerticalVelocity = 0;
      this.lookInitialized = false;
      this.baseFov = CAMERA_BASE_FOV;
      this.currentFov = CAMERA_BASE_FOV;
      this.ctx.rig.setFov(CAMERA_BASE_FOV);
      this.applyWeaponModel(this.ctx.activeWeapon);
      this.resetPartTransforms();
    }
  }
}
