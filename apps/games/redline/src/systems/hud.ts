/**
 * HUD adapter. React renders the shell; this class writes per-frame values and
 * state classes into cached nodes, and still owns the speed-line / flash juice
 * overlays plus start / win / dead card text.
 */

import { RUNNER, STORAGE_KEY } from "../constants";
import type { Phase, RunnerState } from "../types";

function fmtTime(s: number): string {
  return s.toFixed(2);
}

export class Hud {
  private elSpeed = document.getElementById("hud-speed")!;
  private elSpeedWrap = this.elSpeed.parentElement!;
  private elTime = document.getElementById("hud-time")!;
  private elBest = document.getElementById("hud-best")!;
  private elDist = document.getElementById("hud-dist")!;
  private elStatus = document.getElementById("hud-status")!;
  private elProgressFill = document.getElementById("progress-fill")!;

  private speedlines = document.getElementById("speedlines")!;
  private flash = document.getElementById("flash")!;

  private overlay = document.getElementById("overlay")!;
  private overlayCard = document.getElementById("overlay-card")!;

  best: number | null = null;

  constructor() {
    this.best = this.loadBest();
    this.elBest.textContent = this.best === null ? "--.--" : fmtTime(this.best);
  }

  // --- best time persistence ------------------------------------------------
  private loadBest(): number | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  /** Returns true if this is a new record. */
  submitTime(t: number): boolean {
    const record = this.best === null || t < this.best;
    if (record) {
      this.best = t;
      try {
        localStorage.setItem(STORAGE_KEY, String(t));
      } catch {
        /* ignore quota / privacy mode */
      }
      this.elBest.textContent = fmtTime(t);
    }
    return record;
  }

  // --- per-frame ------------------------------------------------------------
  update(opts: {
    speed: number;
    speedFrac: number;
    time: number;
    distance: number;
    progress: number;
    state: RunnerState;
  }) {
    this.elSpeed.textContent = String(Math.round(opts.speed));
    this.elTime.textContent = fmtTime(opts.time);
    this.elDist.textContent = String(Math.round(opts.distance));
    this.elProgressFill.style.width = `${(opts.progress * 100).toFixed(1)}%`;

    // heat the speed readout
    this.elSpeedWrap.classList.toggle("is-hot", opts.speedFrac > 0.5);
    this.elSpeedWrap.classList.toggle("is-redline", opts.speedFrac > RUNNER.redlineFrac);

    // status word + color class
    const words: Record<RunnerState, string> = {
      run: "RUN",
      air: "AIRBORNE",
      dash: "ROLL",
      hit: "STAGGER",
    };
    const cls: Record<RunnerState, string> = {
      run: "s-run",
      air: "s-air",
      dash: "s-dash",
      hit: "s-hit",
    };
    this.elStatus.textContent = words[opts.state];
    this.elStatus.className = cls[opts.state];

    // speed-lines intensify with velocity
    this.speedlines.style.opacity = String(Math.max(0, (opts.speedFrac - 0.25) * 1.25));
  }

  /** Visual punch for a hazard hit. */
  flashHit() {
    this.flash.animate(
      [
        { opacity: 0.9 },
        { opacity: 0 },
      ],
      { duration: 280, easing: "ease-out" },
    );
  }

  /** Soft ember-collect flash (hellfire). */
  flashEmber() {
    this.flash.animate(
      [
        { opacity: 0.28, background: "radial-gradient(circle at 50% 50%, rgba(255,106,0,0.5), transparent 70%)" },
        { opacity: 0 },
      ],
      { duration: 200, easing: "ease-out" },
    );
  }

  // --- overlays -------------------------------------------------------------
  showStart() {
    this.overlay.classList.remove("is-hidden");
    this.overlayCard.innerHTML = `
      <div id="overlay-kicker" class="ssg-menu-kicker">Pyre Courier Run</div>
      <h1 id="overlay-title" class="ssg-menu-title">RED<span class="accent">LINE</span></h1>
      <p id="overlay-body">
        Carry the cargo through the Scourge-rot lane to the BEACON. Beat the clock.
        Hold to build speed, jump the creep spikes, roll under the arches, ride the embers.
      </p>
      <ul id="overlay-controls">
        <li><kbd>HOLD →</kbd> Accelerate</li>
        <li><kbd>SPACE</kbd> Jump</li>
        <li><kbd>SHIFT</kbd> Roll / dash</li>
        <li><kbd>R</kbd> Restart</li>
      </ul>
      <button id="overlay-btn" class="ssg-button ssg-button--primary ssg-button--lg">IGNITE</button>
    `;
  }

  showWin(time: number, isRecord: boolean, embers: number) {
    this.overlay.classList.remove("is-hidden");
    const bestStr = this.best === null ? "--.--" : fmtTime(this.best);
    this.overlayCard.innerHTML = `
      <div id="overlay-kicker" class="ssg-menu-kicker">${isRecord ? "New Personal Best" : "Delivery Complete"}</div>
      <h1 id="overlay-title" class="ssg-menu-title" style="font-size:clamp(40px,9vw,72px)">${isRecord ? "RED<span class='accent'>LINED</span>" : "DELIVERED"}</h1>
      <div id="overlay-stats">
        <div class="stat"><span class="k">Time</span><span class="v ${isRecord ? "gold" : ""}">${fmtTime(time)}</span></div>
        <div class="stat"><span class="k">Best</span><span class="v">${bestStr}</span></div>
        <div class="stat"><span class="k">Embers</span><span class="v">${embers}</span></div>
      </div>
      <button id="overlay-btn" class="ssg-button ssg-button--primary ssg-button--lg">RUN AGAIN</button>
    `;
  }

  showDead(reason: string) {
    this.overlay.classList.remove("is-hidden");
    this.overlayCard.innerHTML = `
      <div id="overlay-kicker" class="ssg-menu-kicker">Run Failed</div>
      <h1 id="overlay-title" class="ssg-menu-title" style="font-size:clamp(40px,9vw,72px)">DOWN<span class="accent">.</span></h1>
      <p id="overlay-body">${reason}</p>
      <button id="overlay-btn" class="ssg-button ssg-button--primary ssg-button--lg">RETRY</button>
    `;
  }

  hideOverlay() {
    this.overlay.classList.add("is-hidden");
  }

  /** Wire the (re)created overlay button to a callback. */
  onOverlayButton(cb: () => void) {
    const btn = document.getElementById("overlay-btn");
    if (btn) btn.addEventListener("click", cb, { once: true });
  }

  isOverlayVisible(phase: Phase): boolean {
    return phase !== "running";
  }
}
