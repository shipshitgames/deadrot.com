import { STARTING_WEAPON, WEAPON_ORDER, WEAPONS } from "../constants";
import type { GameContext } from "../context";
import { CAMPAIGN_ORDER, campaignSequence, DEFAULT_MAP_ID, getMap } from "../data/maps";
import type { GameSystems } from "../systems";

/** Terminal state + the restart / return-to-menu orchestration. */
export class GameOverSystem {
  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  /** "Play Again" — replays the current mode (structured descent restarts from stage 1). */
  restart() {
    // Co-op rooms have no local "restart" — the server owns room state. A Restart click
    // from a co-op pause must not reset stats / rebuild the arena under the
    // live net session (that strands the player in a broken half-run state);
    // treat it as a resume instead.
    if (this.ctx.multiplayer) {
      this.sys.input.requestLock();
      return;
    }
    this.sys.fx.clearTransientFx();
    if (this.ctx.sandbox) {
      this.sys.player.resetPlayer();
      this.sys.pve.startWaveSystem();
      for (const id of WEAPON_ORDER) {
        this.ctx.unlocked.add(id);
        this.ctx.weaponMag[id] = WEAPONS[id].magazineSize;
        this.ctx.weaponReserve[id] = WEAPONS[id].reserveCap;
      }
      this.ctx.activeWeapon = STARTING_WEAPON;
      this.ctx.ammo = WEAPONS[STARTING_WEAPON].magazineSize;
      this.ctx.reserve = WEAPONS[STARTING_WEAPON].reserveCap;
      this.sys.weapon.applyWeaponModel(STARTING_WEAPON);
    } else if (this.ctx.survivors) {
      this.sys.arena.buildArena(getMap(DEFAULT_MAP_ID));
      this.sys.player.resetPlayer(this.sys.survivors.selectedStartingWeapon());
      this.sys.survivors.initSurvivorsRun();
    } else {
      this.ctx.campaignStage = 0;
      if (!this.ctx.campaignMaps.length) this.ctx.campaignMaps = campaignSequence(CAMPAIGN_ORDER[0]);
      this.sys.arena.buildArena(this.ctx.campaignMaps[0]);
      this.sys.player.resetPlayer();
      this.sys.pve.startWaveSystem();
    }
    this.ctx.status = "pointerlock-needed";
    this.sys.hud.emit();
    this.sys.input.requestLock();
  }

  /** Return to the main menu (drops any mode, no auto-lock). */
  returnToMenu() {
    this.sys.multiplayer.leaveMultiplayer(false);
    this.ctx.sandbox = false;
    this.ctx.survivors = false;
    this.ctx.campaignStage = 0;
    this.sys.survivors.recomputeStats();
    this.sys.arena.buildArena(getMap(DEFAULT_MAP_ID));
    this.sys.player.resetPlayer();
    this.sys.fx.clearTransientFx();
    this.sys.survivors.clearSurvivorsEntities();
    this.sys.pve.startWaveSystem();
    this.ctx.status = "pointerlock-needed";
    this.sys.hud.emit();
  }

  gameOver(outcome: "win" | "dead") {
    if (this.ctx.status === "gameover") return;
    this.ctx.status = "gameover";
    this.ctx.outcome = outcome;
    this.ctx.firing = false;
    this.ctx.move.forward = this.ctx.move.back = this.ctx.move.left = this.ctx.move.right = false;
    this.sys.hud.announce(outcome === "win" ? "VICTORY" : "DEFEAT");
    if (this.ctx.rig.captured) this.ctx.rig.releaseCapture();
    this.sys.hud.emit();
  }
}
