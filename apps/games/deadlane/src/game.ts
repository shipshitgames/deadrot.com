import { createFixedLoop, type FixedLoop } from "@deadrot/game-kit/core";
import { FlashOverlay } from "@deadrot/game-kit/juice";
import * as THREE from "three";
import { audio } from "./audio";
import { cellToWorld, inBounds, isPathCell, playBounds, worldToCell } from "./board";
import { COLORS, CONSTANTS } from "./constants";
import { EntitySystem } from "./systems/entities";
import { HudSystem } from "./systems/hud";
import { type HoverCell, InputSystem } from "./systems/input";
import { RenderSystem } from "./systems/render";
import type { GameState, KillEvent } from "./types";
import { setPauseSnapshot } from "./ui/pauseBridge";
import { isBossWave, waveComposition } from "./waves";

/**
 * Game — the thin owner of shared state + the systems, per studio convention.
 * Simulation runs on the shared fixed-step loop (1/120) for determinism; HUD
 * writes, juice, and rendering happen once per displayed frame.
 */
export class Game {
  private readonly state: GameState = freshState();

  private readonly render: RenderSystem;
  private readonly entities: EntitySystem;
  private readonly input: InputSystem;
  private readonly hud: HudSystem;
  private readonly flash: FlashOverlay;
  private readonly loop: FixedLoop;
  private readonly forward = new THREE.Vector3();

  // gameplay events accumulated across the fixed steps of one displayed frame
  private readonly frameKills: KillEvent[] = [];
  private frameBreachDamage = 0;

  private elapsed = 0;
  private pausedForCapture = false;

  constructor(canvas: HTMLCanvasElement) {
    this.render = new RenderSystem(canvas);
    this.entities = new EntitySystem(this.render.scene);
    this.input = new InputSystem(this.render.rig, this.render.groundPlane, () => this.pauseRun());
    this.hud = new HudSystem();
    this.flash = new FlashOverlay(canvas.parentElement ?? document.body);

    document.addEventListener("click", this.onDocumentClick);
    this.render.rig.on("capture", this.onCapture);
    this.render.rig.on("release", this.onRelease);

    this.hud.showBanner(
      "DEADLANE",
      "WARDENS - RUN THE LINE, BUILD BY HAND, AND STOP THE SCOURGE BEFORE THE DOOR EMPTIES.",
      "DEPLOY",
    );
    this.hud.update(this.state);

    this.loop = createFixedLoop({
      fixedDt: CONSTANTS.loop.fixedDt,
      maxFrame: CONSTANTS.loop.maxDelta,
      update: (dt) => {
        this.elapsed += dt;
        this.step(dt);
      },
      render: (_alpha, frameDt) => this.renderFrame(frameDt),
    });
    this.loop.start();
  }

  // ---- state transitions ----------------------------------------------------

  private onBannerClick(): void {
    if (this.pausedForCapture) {
      this.resumeRun();
      void Promise.resolve(this.render.rig.requestCapture()).catch(() => {});
    } else if (this.state.phase === "menu") {
      this.startRun();
    } else if (this.state.phase === "won" || this.state.phase === "lost") {
      this.resetRun();
    }
  }

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("#banner-btn")) return;
    this.onBannerClick();
  };

  private startRun(): void {
    this.hud.hideBanner();
    this.clearPauseMenu();
    this.render.placePlayerAtStart();
    this.input.clearTransientInput();
    this.pausedForCapture = false;
    this.state.phase = "building";
    this.state.hintText = "CLICK THE GAME TO LOCK VIEW";
    this.beginInterWave(CONSTANTS.waves.interWaveDelay);
    this.input.setActive(true);
    audio.unlock();
    void Promise.resolve(this.render.rig.requestCapture()).catch(() => {});
  }

  private resetRun(): void {
    this.entities.clear(this.state);
    Object.assign(this.state, freshState());
    this.hud.update(this.state);
    this.startRun();
  }

  private beginInterWave(delay: number): void {
    this.state.phase = "building";
    this.state.interWaveTimer = delay;
    this.resetBuildProgress();
  }

  private beginWave(): void {
    const s = this.state;
    s.wave += 1;
    s.phase = "wave";
    s.spawnList = waveComposition(s.wave);
    s.spawnTimer = 0;
    if (isBossWave(s.wave)) {
      s.hintText = `WAVE ${s.wave} — ${CONSTANTS.creeps.boss.label} INBOUND. HOLD THE LINE.`;
      audio.sfx("boss");
      this.render.kickShake(0.35);
    } else {
      audio.sfx("wave");
    }
  }

  // ---- fixed-step simulation --------------------------------------------------

  private step(dt: number): void {
    const s = this.state;

    if ((s.phase === "building" || s.phase === "wave") && !this.pausedForCapture) {
      this.handleTowerSelect();
      this.updatePlayer(dt);
      this.handleBuild(dt);
      this.entities.update(s, dt, this.elapsed);
      this.collectEvents();
      this.director(dt);
      this.checkEndConditions();
    } else {
      // menu / won / lost: keep entities frozen but still let hover idle off
      this.render.setHover(null, null, false, 0);
    }
  }

  /** Merge this step's entity events into the per-frame accumulators. */
  private collectEvents(): void {
    const ev = this.entities.events;
    if (ev.kills.length > 0) this.frameKills.push(...ev.kills);
    this.frameBreachDamage += ev.breachDamage;
  }

  // ---- per-displayed-frame: juice, HUD, render --------------------------------

  private renderFrame(frameDt: number): void {
    const baseHit = this.frameBreachDamage > 0;

    if (this.frameKills.length > 0) {
      for (const kill of this.frameKills) {
        const boss = kill.kind === "boss";
        this.render.bursts.spawn({
          position: { x: kill.x, y: 0.7, z: kill.z },
          color: boss ? COLORS.bloodHot : COLORS.toxic,
          count: boss ? 42 : kill.kind === "hulk" ? 24 : 14,
          speed: boss ? 7 : 4.5,
          life: boss ? 0.8 : 0.45,
          gravity: 6,
          upwardBias: 0.6,
          size: boss ? 0.3 : 0.16,
        });
      }
      // cap the audio layering; pitch sells the size difference
      for (const kill of this.frameKills.slice(0, 4)) {
        if (kill.kind === "boss") {
          audio.sfx("explosion");
          this.render.kickShake(0.55);
        } else {
          audio.sfx("kill", { pitch: kill.kind === "hulk" ? 0.78 : kill.kind === "ripper" ? 1.3 : 1 });
        }
      }
      this.frameKills.length = 0;
    }

    if (this.frameBreachDamage > 0) {
      audio.sfx("breach");
      this.render.kickShake(0.22 + 0.06 * this.frameBreachDamage);
      this.flash.flash("#c1121f", { alpha: 0.32 + 0.04 * this.frameBreachDamage, duration: 0.35 });
      this.frameBreachDamage = 0;
    }

    this.hud.update(this.state);
    this.flash.update(frameDt);
    this.render.update(frameDt, this.elapsed, baseHit);
    this.render.render();
  }

  // ---- player / build ----------------------------------------------------------

  private updatePlayer(dt: number): void {
    if (!this.input.active) return;

    const x = Number(this.input.move.right) - Number(this.input.move.left);
    const z = Number(this.input.move.forward) - Number(this.input.move.back);
    const moving = x !== 0 || z !== 0;
    if (moving) {
      const len = Math.hypot(x, z);
      const sprint = this.input.wantsSprint ? CONSTANTS.player.sprintMultiplier : 1;
      const speed = CONSTANTS.player.moveSpeed * sprint * this.runSpeedMul();
      this.render.rig.movePlanar((x / len) * speed * dt, (z / len) * speed * dt);
    }

    const pos = this.render.rig.body.position;
    const radius = CONSTANTS.player.radius;
    pos.x = clamp(pos.x, playBounds.minX + radius, playBounds.maxX - radius);
    pos.z = clamp(pos.z, playBounds.minZ + radius, playBounds.maxZ - radius);
    pos.y = CONSTANTS.player.height;
  }

  private handleTowerSelect(): void {
    const select = this.input.takeSelectAction();
    if (!select || select === this.state.selectedTower) return;
    this.state.selectedTower = select;
    this.resetBuildProgress();
    const def = CONSTANTS.towers[select];
    this.state.hintText = `${def.label} SELECTED (${def.cost})`;
    audio.sfx("uiSelect");
  }

  /** Wave director: spawns creeps, paces waves, declares victory. */
  private director(dt: number): void {
    const s = this.state;

    if (s.phase === "building") {
      s.interWaveTimer -= dt;
      if (s.interWaveTimer <= 0) {
        if (s.wave >= CONSTANTS.waves.total) {
          // all waves already cleared
          this.win();
        } else {
          this.beginWave();
        }
      }
      return;
    }

    if (s.phase === "wave") {
      // spawn the queue
      if (s.spawnList.length > 0) {
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          const kind = s.spawnList.shift();
          if (kind) this.entities.spawnCreep(s, kind);
          s.spawnTimer = CONSTANTS.waves.spawnInterval;
        }
      } else if (s.creeps.length === 0) {
        // wave cleared
        s.gold += CONSTANTS.economy.waveClearBonus;
        audio.sfx("gold");
        if (s.wave >= CONSTANTS.waves.total) {
          this.win();
        } else {
          this.grantWaveBonus();
          this.beginInterWave(CONSTANTS.waves.interWaveDelay);
        }
      }
    }
  }

  private handleBuild(dt: number): void {
    const s = this.state;
    const occupied = this.occupiedSet();
    const target = this.buildTarget();
    const readiness = this.buildReadiness(target, occupied);
    const ready = readiness.ready;
    const targetKey = target ? `${target.col},${target.row}` : null;
    const alreadyBuilding = s.buildProgress > 0 && s.buildTargetKey === targetKey;
    const startBuilding = this.input.takeBuildAction();

    if (ready && (startBuilding || alreadyBuilding)) {
      if (s.buildTargetKey !== targetKey) {
        s.buildTargetKey = targetKey;
        s.buildProgress = 0;
      }
      s.buildProgress += dt * this.buildSpeedMul();
      const pct = Math.min(100, Math.floor((s.buildProgress / CONSTANTS.build.time) * 100));
      s.hintText = `BUILDING ${CONSTANTS.towers[s.selectedTower].label} ${pct}%`;

      if (s.buildProgress >= CONSTANTS.build.time && target) {
        if (this.entities.buildTower(s, target.col, target.row, s.selectedTower)) {
          audio.sfx("build");
        }
        s.hintText = s.lastBonus ? `${s.lastBonus} - TOWER ONLINE` : "TOWER ONLINE";
        this.resetBuildProgress();
      }
    } else {
      if (!ready || s.buildTargetKey !== targetKey) this.resetBuildProgress();
      s.hintText = readiness.hint;
    }

    const progress = Math.min(1, s.buildProgress / CONSTANTS.build.time);
    this.render.setHover(target?.col ?? null, target?.row ?? null, ready, ready ? progress : 0);
  }

  private occupiedSet(): Set<string> {
    const set = new Set<string>();
    for (const t of this.state.towers) set.add(`${t.col},${t.row}`);
    return set;
  }

  private checkEndConditions(): void {
    if (this.state.baseHp <= 0) this.lose();
  }

  private buildTarget(): HoverCell | null {
    const aimed = this.input.aimedCell();
    if (aimed) return aimed;

    const pos = this.render.rig.body.position;
    this.forward.set(0, 0, -1).applyQuaternion(this.render.rig.facing);
    this.forward.y = 0;
    this.forward.normalize();

    const cell = worldToCell(
      pos.x + this.forward.x * CONSTANTS.board.cell,
      pos.z + this.forward.z * CONSTANTS.board.cell,
    );
    return inBounds(cell.col, cell.row) ? cell : null;
  }

  private buildReadiness(cell: HoverCell | null, occupied: Set<string>): { ready: boolean; hint: string } {
    const def = CONSTANTS.towers[this.state.selectedTower];
    const cost = def.cost;
    if (!this.input.active) return { ready: false, hint: "CLICK THE GAME TO LOCK VIEW" };
    if (!cell) return { ready: false, hint: "LOOK AT A BUILD TILE" };
    if (isPathCell(cell.col, cell.row)) return { ready: false, hint: "LANE TILE BLOCKED" };
    if (occupied.has(`${cell.col},${cell.row}`)) return { ready: false, hint: "TOWER ONLINE - MOVE TO NEXT TILE" };
    if (this.state.gold < cost) return { ready: false, hint: `NEED ${cost} GOLD FOR ${def.label}` };

    const p = cellToWorld(cell.col, cell.row);
    const body = this.render.rig.body.position;
    const distance = Math.hypot(p.x - body.x, p.z - body.z);
    if (distance > CONSTANTS.player.buildRange) {
      return { ready: false, hint: `MOVE TO TILE - ${distance.toFixed(1)}M` };
    }

    const bonus = this.state.lastBonus ? `${this.state.lastBonus} - ` : "";
    return { ready: true, hint: `${bonus}PRESS E OR CLICK TO BUILD ${def.label} (${cost})` };
  }

  private resetBuildProgress(): void {
    this.state.buildProgress = 0;
    this.state.buildTargetKey = null;
  }

  private buildSpeedMul(): number {
    return 1 + this.state.buildSpeedLevel * CONSTANTS.bonuses.buildSpeedPerLevel;
  }

  private runSpeedMul(): number {
    return 1 + this.state.runSpeedLevel * CONSTANTS.bonuses.runSpeedPerLevel;
  }

  private grantWaveBonus(): void {
    if (this.state.wave % 2 === 1) {
      this.state.buildSpeedLevel += 1;
      this.state.lastBonus = `BUILD SPEED x${this.buildSpeedMul().toFixed(2)}`;
    } else {
      this.state.runSpeedLevel += 1;
      this.state.lastBonus = `RUN SPEED x${this.runSpeedMul().toFixed(2)}`;
    }
  }

  private win(): void {
    if (this.state.phase === "won") return;
    this.state.phase = "won";
    this.input.setActive(false);
    this.render.rig.releaseCapture(true);
    audio.sfx("victory");
    this.hud.showBanner("LINE HELD", "THE SCOURGE IS SPENT. THE WARDENS STAND. WELL FOUGHT.", "RUN IT BACK");
  }

  private lose(): void {
    if (this.state.phase === "lost") return;
    this.state.phase = "lost";
    this.input.setActive(false);
    this.render.rig.releaseCapture(true);
    this.entities.clear(this.state);
    audio.sfx("defeat");
    this.hud.showBanner("BREACH", "THE BASE IS OVERRUN. THE LANE IS LOST.", "TRY AGAIN");
  }

  private onCapture = (): void => {
    if (this.state.phase !== "building" && this.state.phase !== "wave") return;
    this.resumeRun();
  };

  private onRelease = (): void => {
    this.pauseRun();
  };

  private pauseRun(): void {
    if (this.state.phase !== "building" && this.state.phase !== "wave") return;
    if (this.pausedForCapture) return;
    this.pausedForCapture = true;
    this.input.setActive(false);
    this.resetBuildProgress();
    this.state.hintText = "CLICK RE-ENTER TO RETURN";
    // The shared cinematic PauseMenu (rendered by the React HUD) replaces the
    // old bespoke "PAUSED" banner. Push the run-control callbacks across the
    // bridge so Resume / Exit to title stay wired to the imperative loop.
    setPauseSnapshot({
      open: true,
      onResume: () => {
        // Don't un-pause optimistically: only resume once pointer lock is
        // actually re-acquired (onCapture -> resumeRun). Chrome rejects re-lock
        // during its post-Esc cooldown, which would otherwise leave us un-paused
        // with dead mouse-look. If the click lands in the cooldown the menu stays
        // up and a second click (past the cooldown) locks cleanly.
        void Promise.resolve(this.render.rig.requestCapture()).catch(() => {});
      },
      onExitToTitle: () => this.exitToTitle(),
    });
  }

  private resumeRun(): void {
    if (this.state.phase !== "building" && this.state.phase !== "wave") return;
    this.pausedForCapture = false;
    // Drop the pointerdown that pressed Resume so it can't leak into a queued
    // tower build on the first live frame.
    this.input.clearTransientInput();
    this.input.setActive(true);
    this.clearPauseMenu();
  }

  /** Abandon the current run from the pause menu and return to the title. */
  private exitToTitle(): void {
    this.clearPauseMenu();
    this.pausedForCapture = false;
    this.input.setActive(false);
    this.render.rig.releaseCapture(true);
    this.entities.clear(this.state);
    Object.assign(this.state, freshState());
    this.render.placePlayerAtStart();
    this.hud.update(this.state);
    this.hud.showBanner(
      "DEADLANE",
      "WARDENS - RUN THE LINE, BUILD BY HAND, AND STOP THE SCOURGE BEFORE THE DOOR EMPTIES.",
      "DEPLOY",
    );
  }

  private clearPauseMenu(): void {
    setPauseSnapshot({ open: false, onResume: null, onExitToTitle: null });
  }
}

function freshState(): GameState {
  return {
    phase: "menu",
    gold: CONSTANTS.economy.startGold,
    wave: 0,
    baseHp: CONSTANTS.base.startHp,
    hintText: "PRESS E OR CLICK TO BUILD",
    selectedTower: "ember",
    towers: [],
    creeps: [],
    projectiles: [],
    buildProgress: 0,
    buildTargetKey: null,
    buildSpeedLevel: 0,
    runSpeedLevel: 0,
    lastBonus: null,
    spawnList: [],
    spawnTimer: 0,
    interWaveTimer: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
