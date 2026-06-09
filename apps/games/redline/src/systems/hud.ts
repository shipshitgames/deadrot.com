/**
 * HUD adapter. React renders the shell; this class writes per-frame values and
 * state classes into cached nodes, and still owns the speed-line / flash juice
 * overlays plus start / win / dead card text.
 */

import { createLocalStore } from "@deadrot/game-kit";
import { warlineLobbyHref } from "@shipshitgames/ui";
import { RUNNER, STORAGE_KEY } from "../constants";
import type { RunnerState } from "../types";

function fmtTime(s: number): string {
  return s.toFixed(2);
}

// Best-time persistence. The migrate callback is load-bearing: existing players
// have a legacy bare number string under STORAGE_KEY, and createLocalStore
// routes unversioned payloads through migrate — without it best times reset.
const bestStore = createLocalStore<number | null>(STORAGE_KEY, null, {
  migrate: (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  },
});

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
    this.best = bestStore.get();
    this.elBest.textContent = this.best === null ? "--.--" : fmtTime(this.best);
  }

  /** Returns true if this is a new record. */
  submitTime(t: number): boolean {
    const record = this.best === null || t < this.best;
    if (record) {
      this.best = t;
      bestStore.set(t);
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
    this.flash.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 280, easing: "ease-out" });
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
  showStart(opts: { onIgnite: () => void; onSettings: () => void }) {
    this.overlay.classList.remove("is-hidden");
    this.overlayCard.innerHTML = `
      <div class="ssg-main-menu-copy">
        <div id="overlay-kicker" class="ssg-menu-kicker">Pyre Courier Run</div>
        <h1 id="overlay-title" class="ssg-main-menu-title">
          <span class="ssg-main-menu-title-line ssg-main-menu-title-line--bone">RED</span>
          <span class="ssg-main-menu-title-line ssg-main-menu-title-line--hot">LINE</span>
        </h1>
        <p id="overlay-body" class="ssg-main-menu-subtitle">
          Carry the cargo through the Scourge-rot lane to the BEACON. Beat the clock.
          Hold to build speed, jump the creep spikes, roll under the arches, ride the embers.
        </p>
        <div class="ssg-main-menu-status">
          <span>Courier ready</span>
          <span>${this.best === null ? "No record" : `Best ${fmtTime(this.best)}`}</span>
        </div>
      </div>
      <nav class="ssg-main-menu-nav" aria-label="Main menu">
        <button id="overlay-btn" class="ssg-main-menu-action ssg-main-menu-action--primary">
          <span class="ssg-main-menu-action__label"><span>Ignite</span></span>
          <span class="ssg-main-menu-action__meta">Run the lane</span>
        </button>
        <button class="ssg-main-menu-action ssg-main-menu-action--shop" disabled>
          <span class="ssg-main-menu-action__label"><span>Upgrades</span></span>
          <span class="ssg-main-menu-action__meta">Cargo locked</span>
        </button>
        <button class="ssg-main-menu-action ssg-main-menu-action--coop" disabled>
          <span class="ssg-main-menu-action__label"><span>Co-op</span></span>
          <span class="ssg-main-menu-action__meta">Solo route</span>
        </button>
        <button class="ssg-main-menu-action ssg-main-menu-action--records" disabled>
          <span class="ssg-main-menu-action__label"><span>Leaderboard</span></span>
          <span class="ssg-main-menu-action__meta">${this.best === null ? "No record" : `Best ${fmtTime(this.best)}`}</span>
        </button>
        <button id="overlay-settings-btn" class="ssg-main-menu-action ssg-main-menu-action--settings">
          <span class="ssg-main-menu-action__label"><span>Settings</span></span>
          <span class="ssg-main-menu-action__meta">Audio</span>
        </button>
        <button class="ssg-main-menu-action ssg-main-menu-action--dev" disabled>
          <span class="ssg-main-menu-action__label"><span>Sandbox</span></span>
          <span class="ssg-main-menu-action__meta">Route lab</span>
        </button>
        <a class="ssg-main-menu-action ssg-main-menu-action--default" href="${warlineLobbyHref()}">
          <span class="ssg-main-menu-action__label"><span>← Back to Warline</span></span>
          <span class="ssg-main-menu-action__meta">Lobby</span>
        </a>
      </nav>
    `;
    this.wireOverlayButton(opts.onIgnite);
    // Settings is only present on the start card; { once: true } preserves the
    // current behavior exactly (do not fix the settings re-open quirk here).
    const settingsBtn = document.getElementById("overlay-settings-btn");
    if (settingsBtn) settingsBtn.addEventListener("click", opts.onSettings, { once: true });
  }

  showWin(time: number, isRecord: boolean, embers: number, onAgain: () => void) {
    this.overlay.classList.remove("is-hidden");
    const bestStr = this.best === null ? "--.--" : fmtTime(this.best);
    this.overlayCard.innerHTML = `
      <div class="ssg-main-menu-copy">
        <div id="overlay-kicker" class="ssg-menu-kicker">${isRecord ? "New Personal Best" : "Delivery Complete"}</div>
        <h1 id="overlay-title" class="ssg-main-menu-title">${
          isRecord
            ? "<span class='ssg-main-menu-title-line ssg-main-menu-title-line--bone'>RED</span><span class='ssg-main-menu-title-line ssg-main-menu-title-line--hot'>LINED</span>"
            : "DELIVERED"
        }</h1>
      </div>
      <nav class="ssg-main-menu-nav" aria-label="Run summary">
        <div class="ssg-main-menu-nav__label">Summary</div>
        <div id="overlay-stats">
          <div class="stat"><span class="k">Time</span><span class="v ${isRecord ? "gold" : ""}">${fmtTime(time)}</span></div>
          <div class="stat"><span class="k">Best</span><span class="v">${bestStr}</span></div>
          <div class="stat"><span class="k">Embers</span><span class="v">${embers}</span></div>
        </div>
        <button id="overlay-btn" class="ssg-main-menu-action ssg-main-menu-action--primary">
          <span class="ssg-main-menu-action__label"><span>RUN AGAIN</span></span>
          <span class="ssg-main-menu-action__meta">Beat the clock</span>
        </button>
      </nav>
    `;
    this.wireOverlayButton(onAgain);
  }

  showDead(reason: string, onRetry: () => void) {
    this.overlay.classList.remove("is-hidden");
    this.overlayCard.innerHTML = `
      <div class="ssg-main-menu-copy">
        <div id="overlay-kicker" class="ssg-menu-kicker">Run Failed</div>
        <h1 id="overlay-title" class="ssg-main-menu-title">
          <span class="ssg-main-menu-title-line ssg-main-menu-title-line--bone">DOWN</span>
          <span class="ssg-main-menu-title-line ssg-main-menu-title-line--hot">.</span>
        </h1>
        <p id="overlay-body" class="ssg-main-menu-subtitle">${reason}</p>
      </div>
      <nav class="ssg-main-menu-nav" aria-label="Retry">
        <div class="ssg-main-menu-nav__label">Route lost</div>
        <button id="overlay-btn" class="ssg-main-menu-action ssg-main-menu-action--primary">
          <span class="ssg-main-menu-action__label"><span>RETRY</span></span>
          <span class="ssg-main-menu-action__meta">Run again</span>
        </button>
      </nav>
    `;
    this.wireOverlayButton(onRetry);
  }

  hideOverlay() {
    this.overlay.classList.add("is-hidden");
  }

  /** Wire the freshly created primary overlay button to a callback. */
  private wireOverlayButton(cb: () => void) {
    const btn = document.getElementById("overlay-btn");
    if (btn) btn.addEventListener("click", cb, { once: true });
  }
}
