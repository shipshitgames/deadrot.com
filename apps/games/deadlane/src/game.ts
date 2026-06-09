import * as THREE from "three";
import { cellToWorld, inBounds, isPathCell, playBounds, worldToCell } from "./board";
import { CONSTANTS } from "./constants";
import { buildSpeedMul, runSpeedMul } from "./stats";
import { EntitySystem } from "./systems/entities";
import { HudSystem } from "./systems/hud";
import { type HoverCell, InputSystem } from "./systems/input";
import { RenderSystem } from "./systems/render";
import type { GameState } from "./types";
import { setPauseSnapshot } from "./ui/pauseBridge";

/**
 * Game — the thin owner of shared state + the systems, per studio convention.
 * It runs a single requestAnimationFrame loop with a clamped delta and drives
 * the wave director (the only "AI" in the build).
 */
export class Game {
  private readonly state: GameState = freshState();

  private readonly render: RenderSystem;
  private readonly entities: EntitySystem;
  private readonly input: InputSystem;
  private readonly hud: HudSystem;
  private readonly forward = new THREE.Vector3();

  private last = 0;
  private elapsed = 0;
  private pausedForCapture = false;

  constructor(canvas: HTMLCanvasElement) {
    this.render = new RenderSystem(canvas);
    this.entities = new EntitySystem(this.render.scene);
    this.input = new InputSystem(this.render.rig, this.render.groundPlane, () => this.pauseRun());
    this.hud = new HudSystem();

    document.addEventListener("click", this.onDocumentClick);
    this.render.rig.on("capture", this.onCapture);
    this.render.rig.on("release", this.onRelease);

    this.showTitleBanner();
    this.hud.update(this.state);

    requestAnimationFrame((t) => this.frame(t));
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
    this.state.wave += 1;
    this.state.phase = "wave";
    this.state.spawnQueue = CONSTANTS.waves.baseCount + (this.state.wave - 1) * CONSTANTS.waves.countGrowth;
    this.state.spawnTimer = 0;
  }

  // ---- main loop ------------------------------------------------------------

  private frame(now: number): void {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, CONSTANTS.loop.maxDelta);
    this.elapsed += dt;

    this.step(dt);

    this.render.update(dt, this.elapsed, this.entities.baseHitThisFrame);
    this.render.render();

    requestAnimationFrame((t) => this.frame(t));
  }

  private step(dt: number): void {
    const s = this.state;

    if (this.isRunLive() && !this.pausedForCapture) {
      this.updatePlayer(dt);
      this.handleBuild(dt);
      this.entities.update(s, dt, this.elapsed);
      this.director(dt);
      this.checkEndConditions();
    } else {
      // menu / won / lost: keep entities frozen but still let hover idle off
      this.render.setHover(null, null, false, 0);
    }

    this.hud.update(s);
  }

  private updatePlayer(dt: number): void {
    if (!this.input.active) return;

    const x = Number(this.input.move.right) - Number(this.input.move.left);
    const z = Number(this.input.move.forward) - Number(this.input.move.back);
    const moving = x !== 0 || z !== 0;
    if (moving) {
      const len = Math.hypot(x, z);
      const sprint = this.input.wantsSprint ? CONSTANTS.player.sprintMultiplier : 1;
      const speed = CONSTANTS.player.moveSpeed * sprint * runSpeedMul(this.state);
      this.render.rig.movePlanar((x / len) * speed * dt, (z / len) * speed * dt);
    }

    const pos = this.render.rig.body.position;
    const radius = CONSTANTS.player.radius;
    pos.x = clamp(pos.x, playBounds.minX + radius, playBounds.maxX - radius);
    pos.z = clamp(pos.z, playBounds.minZ + radius, playBounds.maxZ - radius);
    pos.y = CONSTANTS.player.height;
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
      if (s.spawnQueue > 0) {
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          this.entities.spawnCreep(s);
          s.spawnQueue -= 1;
          s.spawnTimer = CONSTANTS.waves.spawnInterval;
        }
      } else if (s.creeps.length === 0) {
        // wave cleared
        s.gold += CONSTANTS.economy.waveClearBonus;
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
      s.buildProgress += dt * buildSpeedMul(s);
      const pct = Math.min(100, Math.floor((s.buildProgress / CONSTANTS.build.time) * 100));
      s.hintText = `BUILDING TOWER ${pct}%`;

      if (s.buildProgress >= CONSTANTS.build.time && target) {
        this.entities.buildTower(s, target.col, target.row);
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
    const cost = CONSTANTS.economy.towerCost;
    if (!this.input.active) return { ready: false, hint: "CLICK THE GAME TO LOCK VIEW" };
    if (!cell) return { ready: false, hint: "LOOK AT A BUILD TILE" };
    if (isPathCell(cell.col, cell.row)) return { ready: false, hint: "LANE TILE BLOCKED" };
    if (occupied.has(`${cell.col},${cell.row}`)) return { ready: false, hint: "TOWER ONLINE - MOVE TO NEXT TILE" };
    if (this.state.gold < cost) return { ready: false, hint: `NEED ${cost} GOLD` };

    const p = cellToWorld(cell.col, cell.row);
    const body = this.render.rig.body.position;
    const distance = Math.hypot(p.x - body.x, p.z - body.z);
    if (distance > CONSTANTS.player.buildRange) {
      return { ready: false, hint: `MOVE TO TILE - ${distance.toFixed(1)}M` };
    }

    const bonus = this.state.lastBonus ? `${this.state.lastBonus} - ` : "";
    return { ready: true, hint: `${bonus}PRESS E OR CLICK TO BUILD (${cost})` };
  }

  private resetBuildProgress(): void {
    this.state.buildProgress = 0;
    this.state.buildTargetKey = null;
  }

  private grantWaveBonus(): void {
    if (this.state.wave % 2 === 1) {
      this.state.buildSpeedLevel += 1;
      this.state.lastBonus = `BUILD SPEED x${buildSpeedMul(this.state).toFixed(2)}`;
    } else {
      this.state.runSpeedLevel += 1;
      this.state.lastBonus = `RUN SPEED x${runSpeedMul(this.state).toFixed(2)}`;
    }
  }

  /** A run is live while waves are being built for or fought. */
  private isRunLive(): boolean {
    return this.state.phase === "building" || this.state.phase === "wave";
  }

  private showTitleBanner(): void {
    this.hud.showBanner(
      "DEADLANE",
      "WARDENS - RUN THE LINE, BUILD BY HAND, AND STOP THE SCOURGE BEFORE THE DOOR EMPTIES.",
      "DEPLOY",
    );
  }

  private win(): void {
    if (this.state.phase === "won") return;
    this.state.phase = "won";
    this.input.setActive(false);
    this.render.rig.releaseCapture(true);
    this.hud.showBanner("LINE HELD", "THE SCOURGE IS SPENT. THE WARDENS STAND. WELL FOUGHT.", "RUN IT BACK");
  }

  private lose(): void {
    if (this.state.phase === "lost") return;
    this.state.phase = "lost";
    this.input.setActive(false);
    this.render.rig.releaseCapture(true);
    this.entities.clear(this.state);
    this.hud.showBanner("BREACH", "THE BASE IS OVERRUN. THE LANE IS LOST.", "TRY AGAIN");
  }

  private onCapture = (): void => {
    if (!this.isRunLive()) return;
    this.resumeRun();
  };

  private onRelease = (): void => {
    this.pauseRun();
  };

  private pauseRun(): void {
    if (!this.isRunLive()) return;
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
    if (!this.isRunLive()) return;
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
    this.showTitleBanner();
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
    towers: [],
    creeps: [],
    projectiles: [],
    buildProgress: 0,
    buildTargetKey: null,
    buildSpeedLevel: 0,
    runSpeedLevel: 0,
    lastBonus: null,
    spawnQueue: 0,
    spawnTimer: 0,
    interWaveTimer: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
