import { STAGE_CLEAR_HEAL } from "../constants";
import type { GameContext } from "../context";
import { getMap } from "../data/maps";
import {
  advanceMissionAfterBoss,
  createIdleMissionState,
  createMissionRun,
  currentMissionStage,
} from "../data/missions";
import type { GameSystems } from "../systems";

export class MissionSystem {
  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  startCampaign(startMapId?: string) {
    this.sys.multiplayer.leaveMultiplayer(false);
    this.ctx.campaign = true;
    this.ctx.sandbox = false;
    this.ctx.survivors = false;
    this.sys.survivors.recomputeStats();

    this.ctx.mission = createMissionRun(startMapId);
    this.ctx.campaignMaps = this.ctx.mission.stages.map((stage) => getMap(stage.mapId));
    this.ctx.campaignStage = this.ctx.mission.stageIndex;

    const first = currentMissionStage(this.ctx.mission);
    if (!first) return;
    this.sys.arena.buildArena(this.ctx.campaignMaps[0]);
    this.prepareCampaignRun();
    this.ctx.status = "pointerlock-needed";
    this.sys.hud.emit();
    this.sys.input.requestLock();
  }

  restartCampaign() {
    const startMapId = this.ctx.mission.startMapId ?? this.ctx.campaignMaps[0]?.id;
    this.startCampaign(startMapId ?? undefined);
  }

  clearMissionState() {
    this.ctx.campaign = false;
    this.ctx.campaignMaps = [];
    this.ctx.campaignStage = 0;
    this.ctx.mission = createIdleMissionState();
  }

  onBossDefeated() {
    const previousStage = this.ctx.campaignStage;
    this.ctx.mission = advanceMissionAfterBoss(this.ctx.mission);

    if (this.ctx.mission.completed) {
      this.ctx.campaignStage = this.ctx.mission.stageIndex;
      this.sys.gameOver.gameOver("win");
      return;
    }

    const next = currentMissionStage(this.ctx.mission);
    if (!next) {
      this.sys.gameOver.gameOver("win");
      return;
    }

    this.ctx.campaignStage = this.ctx.mission.stageIndex;
    this.ctx.health = Math.min(this.ctx.maxHealthValue, this.ctx.health + STAGE_CLEAR_HEAL);
    this.sys.arena.buildArena(this.ctx.campaignMaps[this.ctx.campaignStage]);
    this.sys.fx.clearTransientFx();
    this.sys.arena.placeAtSpawn();
    this.sys.pve.startWaveSystem();
    if (this.ctx.campaignStage !== previousStage) {
      this.sys.hud.announce(
        `STAGE ${this.ctx.campaignStage + 1}/${this.ctx.campaignMaps.length} · ${next.mapName.toUpperCase()}`,
      );
    }
    this.sys.hud.emit();
  }

  private prepareCampaignRun() {
    this.sys.player.resetPlayer();
    this.sys.fx.clearTransientFx();
    this.sys.survivors.clearSurvivorsEntities();
    this.sys.pve.startWaveSystem();
  }
}
