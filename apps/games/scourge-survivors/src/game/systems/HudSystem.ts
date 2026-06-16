import { HudCoreSystem, type HudExtension } from "@deadrot/game-kit/hud";
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
import type { ScourgeHudExt } from "../types";

/**
 * Scourge Survivors' HUD system. The genre-neutral machinery — monotonic
 * feedback channels (`hitSeq`/`emphasisSeq`/`killSeq`/`damageSeq`), the centre
 * banner + pickup toast, and world→screen floating combat numbers — now lives in
 * the shared {@link HudCoreSystem}. This subclass only supplies the Scourge
 * bridge: the player vitals, the game-specific HUD fields, and the audio cue an
 * `announce()` banner should fire.
 *
 * The extension closes over the `ctx`/`sys` constructor params (not `this`), so
 * it can be built and handed to `super()` before the instance exists.
 */
export class HudSystem extends HudCoreSystem<ScourgeHudExt> {
  constructor(ctx: GameContext, sys: GameSystems) {
    const extension: HudExtension<ScourgeHudExt> = {
      vitals: () => ({
        playerHealth: Math.round(ctx.health),
        maxPlayerHealth: ctx.maxHealthValue,
      }),
      onAnnounce: (text) => {
        if (text === "VICTORY") audio.sfx("victory");
        else if (text === "DEFEAT") audio.sfx("defeat");
        else if (text.includes("BOSS")) audio.sfx("boss");
        else if (text.startsWith("WAVE") && !text.includes("CLEARED")) audio.sfx("wave");
      },
      read: () => {
        const spec = WEAPONS[ctx.activeWeapon];
        const weapons = WEAPON_ORDER.filter((id) => ctx.unlocked.has(id)).map((id) => ({
          id,
          name: WEAPONS[id].name,
          key: WEAPON_ORDER.indexOf(id) + 1,
          active: id === ctx.activeWeapon,
        }));
        const identity = weaponIdentityFor(ctx.activeWeapon);
        const survivorClass = SURVIVOR_CLASSES[ctx.survivorClassId] ?? SURVIVOR_CLASSES.ranger;
        const survivorChapter = sys.survivors.currentChapter();
        const missionObjective = currentMissionObjective(ctx.mission);
        const missionCheckpoint = currentMissionCheckpoint(ctx.mission);
        const missionEncounter = currentMissionEncounter(ctx.mission);
        const evolved = Object.entries(sys.survivors.evolved)
          .filter(([, on]) => on)
          .map(([id]) => EVOLUTIONS[id as keyof typeof EVOLUTIONS].name);
        const weaponTier = sys.survivors.mainWeaponVisualTier();
        const runMode: ScourgeHudExt["runMode"] = ctx.multiplayer
          ? "coop"
          : ctx.survivors
            ? "structured"
            : ctx.sandbox
              ? "sandbox"
              : "campaign";
        const campaignDepthTotal = ctx.campaignMaps.length || TOTAL_WAVES;
        const runDepth = ctx.survivors
          ? ctx.survivorChapter + 1
          : ctx.campaignMaps.length
            ? ctx.campaignStage + 1
            : Math.min(sys.pve.waveIndex + 1, TOTAL_WAVES);
        const runDepthTotal = ctx.survivors ? ctx.survivorTotalChapters : campaignDepthTotal;
        const runDepthName = ctx.survivors ? survivorChapter.name : ctx.currentMap.name;
        return {
          status: ctx.status,
          ammo: ctx.ammo,
          magazineSize: spec.magazineSize,
          reserve: ctx.reserve,
          reloading: ctx.reloading,
          reloadProgress: ctx.reloading ? Math.min(1, 1 - ctx.reloadTimer / RELOAD_TIME) : 0,
          score: ctx.score,
          kills: ctx.kills,
          headshots: ctx.headshots,
          bossKills: ctx.bossKills,
          enemiesAlive: ctx.aliveCount,
          combo: ctx.combo,
          time: Math.floor(ctx.time),
          runMode,
          runDepth,
          runDepthTotal,
          runDepthName,
          wave: Math.min(sys.pve.waveIndex + 1, TOTAL_WAVES),
          totalWaves: TOTAL_WAVES,
          campaignStage: ctx.campaignStage + 1,
          campaignTotalStages: ctx.campaignMaps.length,
          mapName: ctx.currentMap.name,
          bossActive: sys.pve.bossActive,
          bossHealthFrac:
            sys.pve.bossActive && sys.pve.bossEnemy?.alive ? sys.pve.bossEnemy.health / sys.pve.bossMaxHealth : 0,
          bossName: sys.pve.bossName,
          outcome: ctx.outcome,
          weapon: spec.name,
          weapons,
          weaponIdentity: {
            callsign: identity.callsign,
            role: identity.role,
            fantasy: identity.fantasy,
            ads: identity.ads.label,
            dualCompatible: identity.dualCompatible,
          },
          damageBoost: Math.ceil(ctx.damageBoostTimer),
          berserk: Math.ceil(ctx.damageBoostTimer),
          berserkFrac: Math.max(0, Math.min(1, ctx.damageBoostTimer / BERSERK_TIME)),
          dualWeapon: Math.ceil(ctx.dualWeaponTimer),
          ads: ctx.aimingDownSights || ctx.adsT > 0.05,
          adsZoom: ctx.adsZoomIndex + 1,
          adsZoomLevels: spec.adsFovs.length,
          bossShielded: !!(sys.pve.bossEnemy?.alive && sys.pve.bossEnemy.shielded),
          bossEnraged: !!(sys.pve.bossEnemy?.alive && sys.pve.bossEnemy.enraged),
          multiplayer: ctx.multiplayer,
          connected: sys.multiplayer.connected,
          room: sys.multiplayer.roomName,
          scoreboard: ctx.multiplayer ? sys.multiplayer.buildScoreboard() : [],
          campaign: ctx.campaign,
          missionId: ctx.mission.missionId ?? "",
          missionTitle: ctx.mission.missionTitle,
          missionPhase: ctx.mission.phase,
          missionObjective: missionObjective?.label ?? "",
          missionCheckpoint: missionCheckpoint?.name ?? "",
          missionEncounter: missionEncounter?.name ?? "",
          missionExtractionReady: ctx.mission.extractionReady,
          missionComplete: ctx.mission.completed,
          sandbox: ctx.sandbox,
          survivors: ctx.survivors,
          survivorClassId: survivorClass.id,
          survivorClassName: survivorClass.name,
          survivorClassRole: survivorClass.role,
          survivorClassIcon: survivorClass.icon,
          survivorChapter: ctx.survivorChapter + 1,
          survivorTotalChapters: ctx.survivorTotalChapters,
          survivorChapterName: survivorChapter.name,
          survivorChapterSubtitle: survivorChapter.subtitle,
          survivorChapterProgress: sys.survivors.currentChapterProgress(),
          survivorGoalTime: ctx.survivorGoalTime,
          survivorShield: Math.round(ctx.statShield),
          survivorMaxShield: Math.round(ctx.statShieldMax),
          survivorArmor: Math.round(Math.min(0.95, ctx.statArmor) * 100),
          survivorDodge: Math.round(Math.min(0.95, ctx.statDodge) * 100),
          survivorGrace: Math.round(ctx.statGrace * 100) / 100,
          survivorEvolved: evolved,
          survivorWeaponTier: weaponTier,
          survivorWeaponTierLabel: MAIN_WEAPON_TIER_LABEL[weaponTier],
          survivorWeaponTierIndex: mainWeaponTierIndex(weaponTier),
          survivorWeaponTierDamageMul: mainWeaponTierDamageMul(weaponTier),
          level: sys.survivors.level,
          xp: Math.floor(sys.survivors.xp),
          xpToNext: sys.survivors.xpToNext,
          build: ctx.survivors ? sys.survivors.buildList() : [],
          choices: ctx.status === "levelup" ? sys.survivors.choices : [],
          rerolls: sys.survivors.rerolls,
          banishes: sys.survivors.banishes,
        };
      },
    };
    super(ctx, extension, ctx.listener);
  }
}
