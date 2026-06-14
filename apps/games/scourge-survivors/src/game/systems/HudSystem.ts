import type * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import { BERSERK_TIME, RELOAD_TIME, TOTAL_WAVES, WEAPON_ORDER, WEAPONS } from "../constants";
import type { GameContext } from "../context";
import { currentMissionCheckpoint, currentMissionEncounter, currentMissionObjective } from "../data/missions";
import {
  EVOLUTIONS,
  MAIN_WEAPON_TIER_LABEL,
  mainWeaponTierDamageMul,
  mainWeaponTierIndex,
  SURVIVOR_CLASSES,
} from "../data/survivors";
import { weaponIdentityFor } from "../data/weaponIdentity";
import type { GameSystems } from "../systems";
import type { HUDState } from "../types";

export class HudSystem {
  // HUD sync
  emitAccumulator = 0;
  hitMarkerSeq = 0;
  headshotSeq = 0;
  killSeq = 0;
  damageSeq = 0;
  damageNumbers: { id: number; x: number; y: number; amount: number; kind: "normal" | "head" | "crit"; t: number }[] =
    [];
  damageNumberId = 0;
  banner = "";
  bannerSeq = 0;
  toast = "";
  toastSeq = 0;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  /** Drop the current centre banner (bannerSeq 0 = nothing to render). Called on
   *  run start so a prior "DEFEAT"/"VICTORY" can't re-flash in the new run. */
  clearBanner() {
    this.banner = "";
    this.bannerSeq = 0;
  }

  announce(text: string) {
    this.banner = text;
    this.bannerSeq++;
    if (text === "VICTORY") audio.sfx("victory");
    else if (text === "DEFEAT") audio.sfx("defeat");
    else if (text.includes("BOSS")) audio.sfx("boss");
    else if (text.startsWith("WAVE") && !text.includes("CLEARED")) audio.sfx("wave");
    this.emit();
  }

  showToast(text: string) {
    this.toast = text;
    this.toastSeq++;
    this.emit();
  }

  static readonly DAMAGE_NUMBER_TTL = 0.9;
  /** Spawn a floating damage number at a world position (projected to screen). */
  addDamageNumber(world: THREE.Vector3, amount: number, kind: "normal" | "head" | "crit") {
    const v = world.clone().project(this.ctx.camera);
    if (v.z > 1) return; // behind the camera — don't show
    const x = (v.x * 0.5 + 0.5) * 100;
    const y = (-v.y * 0.5 + 0.5) * 100;
    this.damageNumbers.push({
      id: ++this.damageNumberId,
      x,
      y,
      amount: Math.max(1, Math.round(amount)),
      kind,
      t: this.ctx.time,
    });
    if (this.damageNumbers.length > 40) this.damageNumbers.shift();
  }

  emit() {
    if (this.ctx.disposed) return;
    // Drop floating damage numbers once their CSS animation has finished.
    if (this.damageNumbers.length) {
      this.damageNumbers = this.damageNumbers.filter((d) => this.ctx.time - d.t < HudSystem.DAMAGE_NUMBER_TTL);
    }
    const spec = WEAPONS[this.ctx.activeWeapon];
    const weapons = WEAPON_ORDER.filter((id) => this.ctx.unlocked.has(id)).map((id) => ({
      id,
      name: WEAPONS[id].name,
      key: WEAPON_ORDER.indexOf(id) + 1,
      active: id === this.ctx.activeWeapon,
    }));
    const identity = weaponIdentityFor(this.ctx.activeWeapon);
    const survivorClass = SURVIVOR_CLASSES[this.ctx.survivorClassId] ?? SURVIVOR_CLASSES.ranger;
    const survivorChapter = this.sys.survivors.currentChapter();
    const missionObjective = currentMissionObjective(this.ctx.mission);
    const missionCheckpoint = currentMissionCheckpoint(this.ctx.mission);
    const missionEncounter = currentMissionEncounter(this.ctx.mission);
    const evolved = Object.entries(this.sys.survivors.evolved)
      .filter(([, on]) => on)
      .map(([id]) => EVOLUTIONS[id as keyof typeof EVOLUTIONS].name);
    const weaponTier = this.sys.survivors.mainWeaponVisualTier();
    const runMode: HUDState["runMode"] = this.ctx.multiplayer
      ? "coop"
      : this.ctx.survivors
        ? "structured"
        : this.ctx.sandbox
          ? "sandbox"
          : "campaign";
    const campaignDepthTotal = this.ctx.campaignMaps.length || TOTAL_WAVES;
    const runDepth = this.ctx.survivors
      ? this.ctx.survivorChapter + 1
      : this.ctx.campaignMaps.length
        ? this.ctx.campaignStage + 1
        : Math.min(this.sys.pve.waveIndex + 1, TOTAL_WAVES);
    const runDepthTotal = this.ctx.survivors ? this.ctx.survivorTotalChapters : campaignDepthTotal;
    const runDepthName = this.ctx.survivors ? survivorChapter.name : this.ctx.currentMap.name;
    const state: HUDState = {
      status: this.ctx.status,
      playerHealth: Math.round(this.ctx.health),
      maxPlayerHealth: this.ctx.maxHealthValue,
      ammo: this.ctx.ammo,
      magazineSize: spec.magazineSize,
      reserve: this.ctx.reserve,
      reloading: this.ctx.reloading,
      reloadProgress: this.ctx.reloading ? Math.min(1, 1 - this.ctx.reloadTimer / RELOAD_TIME) : 0,
      score: this.ctx.score,
      kills: this.ctx.kills,
      headshots: this.ctx.headshots,
      bossKills: this.ctx.bossKills,
      enemiesAlive: this.ctx.aliveCount,
      combo: this.ctx.combo,
      time: Math.floor(this.ctx.time),
      runMode,
      runDepth,
      runDepthTotal,
      runDepthName,
      wave: Math.min(this.sys.pve.waveIndex + 1, TOTAL_WAVES),
      totalWaves: TOTAL_WAVES,
      campaignStage: this.ctx.campaignStage + 1,
      campaignTotalStages: this.ctx.campaignMaps.length,
      mapName: this.ctx.currentMap.name,
      bossActive: this.sys.pve.bossActive,
      bossHealthFrac:
        this.sys.pve.bossActive && this.sys.pve.bossEnemy && this.sys.pve.bossEnemy.alive
          ? this.sys.pve.bossEnemy.health / this.sys.pve.bossMaxHealth
          : 0,
      outcome: this.ctx.outcome,
      weapon: spec.name,
      weapons,
      weaponIdentity: {
        callsign: identity.callsign,
        role: identity.role,
        fantasy: identity.fantasy,
        ads: identity.ads.label,
        dualCompatible: identity.dualCompatible,
      },
      damageBoost: Math.ceil(this.ctx.damageBoostTimer),
      berserk: Math.ceil(this.ctx.damageBoostTimer),
      berserkFrac: Math.max(0, Math.min(1, this.ctx.damageBoostTimer / BERSERK_TIME)),
      dualWeapon: Math.ceil(this.ctx.dualWeaponTimer),
      ads: this.ctx.aimingDownSights || this.ctx.adsT > 0.05,
      adsZoom: this.ctx.adsZoomIndex + 1,
      adsZoomLevels: spec.adsFovs.length,
      bossShielded: !!(this.sys.pve.bossEnemy && this.sys.pve.bossEnemy.alive && this.sys.pve.bossEnemy.shielded),
      bossEnraged: !!(this.sys.pve.bossEnemy && this.sys.pve.bossEnemy.alive && this.sys.pve.bossEnemy.enraged),
      hitMarkerSeq: this.hitMarkerSeq,
      headshotSeq: this.headshotSeq,
      killSeq: this.killSeq,
      damageSeq: this.damageSeq,
      banner: this.banner,
      bannerSeq: this.bannerSeq,
      toast: this.toast,
      toastSeq: this.toastSeq,
      damageNumbers: this.damageNumbers.map(({ t, ...d }) => d),
      multiplayer: this.ctx.multiplayer,
      connected: this.sys.multiplayer.connected,
      room: this.sys.multiplayer.roomName,
      scoreboard: this.ctx.multiplayer ? this.sys.multiplayer.buildScoreboard() : [],
      campaign: this.ctx.campaign,
      missionId: this.ctx.mission.missionId ?? "",
      missionTitle: this.ctx.mission.missionTitle,
      missionPhase: this.ctx.mission.phase,
      missionObjective: missionObjective?.label ?? "",
      missionCheckpoint: missionCheckpoint?.name ?? "",
      missionEncounter: missionEncounter?.name ?? "",
      missionExtractionReady: this.ctx.mission.extractionReady,
      missionComplete: this.ctx.mission.completed,
      sandbox: this.ctx.sandbox,
      survivors: this.ctx.survivors,
      survivorClassId: survivorClass.id,
      survivorClassName: survivorClass.name,
      survivorClassRole: survivorClass.role,
      survivorClassIcon: survivorClass.icon,
      survivorChapter: this.ctx.survivorChapter + 1,
      survivorTotalChapters: this.ctx.survivorTotalChapters,
      survivorChapterName: survivorChapter.name,
      survivorChapterSubtitle: survivorChapter.subtitle,
      survivorChapterProgress: this.sys.survivors.currentChapterProgress(),
      survivorGoalTime: this.ctx.survivorGoalTime,
      survivorShield: Math.round(this.ctx.statShield),
      survivorMaxShield: Math.round(this.ctx.statShieldMax),
      survivorArmor: Math.round(Math.min(0.95, this.ctx.statArmor) * 100),
      survivorDodge: Math.round(Math.min(0.95, this.ctx.statDodge) * 100),
      survivorGrace: Math.round(this.ctx.statGrace * 100) / 100,
      survivorEvolved: evolved,
      survivorWeaponTier: weaponTier,
      survivorWeaponTierLabel: MAIN_WEAPON_TIER_LABEL[weaponTier],
      survivorWeaponTierIndex: mainWeaponTierIndex(weaponTier),
      survivorWeaponTierDamageMul: mainWeaponTierDamageMul(weaponTier),
      level: this.sys.survivors.level,
      xp: Math.floor(this.sys.survivors.xp),
      xpToNext: this.sys.survivors.xpToNext,
      build: this.ctx.survivors ? this.sys.survivors.buildList() : [],
      choices: this.ctx.status === "levelup" ? this.sys.survivors.choices : [],
      rerolls: this.sys.survivors.rerolls,
      banishes: this.sys.survivors.banishes,
    };
    this.ctx.listener(state);
  }
}
