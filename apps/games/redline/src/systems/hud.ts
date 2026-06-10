/**
 * HUD adapter. React renders the shell; this class writes per-frame values and
 * state classes into cached nodes, and still owns the speed-line / flash juice
 * overlays plus start / win / dead card text.
 */

import { warlineLobbyHref } from "@shipshitgames/ui";
import { COURSE, RUNNER, SCORE } from "../constants";
import type { RunnerState } from "../types";
import { applyRunRecord, bestFor, createBestsStore, type RunSummary } from "./score";

function fmtTime(s: number): string {
  return s.toFixed(2);
}

/** Which records a finished run broke (returned by submitRun). */
export interface RunRecords {
  newBestTime: boolean;
  newBestScore: boolean;
}

export class Hud {
  private elSpeed = document.getElementById("hud-speed")!;
  private elSpeedWrap = this.elSpeed.parentElement!;
  private elTime = document.getElementById("hud-time")!;
  private elBest = document.getElementById("hud-best")!;
  private elDist = document.getElementById("hud-dist")!;
  private elScore = document.getElementById("hud-score")!;
  private elStatus = document.getElementById("hud-status")!;
  private elProgressFill = document.getElementById("progress-fill")!;

  private elChain = document.getElementById("chain")!;
  private elChainMult = document.getElementById("chain-mult")!;
  private elChainFill = document.getElementById("chain-meter-fill")!;
  private lastChain = 1;

  private speedlines = document.getElementById("speedlines")!;
  private flash = document.getElementById("flash")!;

  private overlay = document.getElementById("overlay")!;
  private overlayCard = document.getElementById("overlay-card")!;

  // Per-seed bests, persisted through the versioned game-kit store (which
  // migrates the legacy raw best-time payload on first read).
  private readonly store = createBestsStore();
  best: number | null = null;
  bestScore: number | null = null;

  constructor() {
    const seedBest = bestFor(this.store.get(), COURSE.seed);
    this.best = seedBest.time;
    this.bestScore = seedBest.score;
    this.elBest.textContent = this.best === null ? "--.--" : fmtTime(this.best);
  }

  // --- best run persistence ---------------------------------------------------
  /** Fold a finished run into the per-seed bests; reports broken records. */
  submitRun(time: number, score: number): RunRecords {
    const { next, newBestTime, newBestScore } = applyRunRecord(this.store.get(), COURSE.seed, time, score);
    this.store.set(next);
    const seedBest = bestFor(next, COURSE.seed);
    this.best = seedBest.time;
    this.bestScore = seedBest.score;
    this.elBest.textContent = this.best === null ? "--.--" : fmtTime(this.best);
    return { newBestTime, newBestScore };
  }

  // --- per-frame ------------------------------------------------------------
  update(opts: {
    speed: number;
    speedFrac: number;
    time: number;
    distance: number;
    progress: number;
    state: RunnerState;
    score: number;
    chain: number;
    chainFrac: number;
  }) {
    this.elSpeed.textContent = String(Math.round(opts.speed));
    this.elTime.textContent = fmtTime(opts.time);
    this.elDist.textContent = String(Math.round(opts.distance));
    this.elScore.textContent = String(opts.score);
    this.elProgressFill.style.width = `${(opts.progress * 100).toFixed(1)}%`;

    // ember chain badge: visible while the multiplier is hot
    const live = opts.chain > 1;
    this.elChain.classList.toggle("is-live", live);
    this.elChain.classList.toggle("is-max", opts.chain >= SCORE.chainMax);
    if (live) {
      this.elChainMult.textContent = `x${opts.chain}`;
      this.elChainFill.style.width = `${(opts.chainFrac * 100).toFixed(1)}%`;
    }
    if (opts.chain > this.lastChain && live) {
      // pop on each chain step up
      this.elChain.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], {
        duration: 160,
        easing: "ease-out",
      });
    }
    this.lastChain = opts.chain;

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

  /** "Best 23.45 · 5200 pts" (whichever records exist), or "No record". */
  private bestLabel(): string {
    if (this.best === null && this.bestScore === null) return "No record";
    const parts: string[] = [];
    if (this.best !== null) parts.push(`Best ${fmtTime(this.best)}`);
    if (this.bestScore !== null) parts.push(`${this.bestScore} pts`);
    return parts.join(" · ");
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
          <span>${this.bestLabel()}</span>
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
          <span class="ssg-main-menu-action__meta">${this.bestLabel()}</span>
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

  showWin(summary: RunSummary, records: RunRecords, onAgain: () => void) {
    this.overlay.classList.remove("is-hidden");
    const isRecord = records.newBestTime || records.newBestScore;
    const kicker = records.newBestTime
      ? "New Personal Best"
      : records.newBestScore
        ? "New High Score"
        : "Delivery Complete";
    const bestTimeStr = this.best === null ? "--.--" : fmtTime(this.best);
    const bestScoreStr = this.bestScore === null ? "--" : String(this.bestScore);
    this.overlayCard.innerHTML = `
      <div class="ssg-main-menu-copy">
        <div id="overlay-kicker" class="ssg-menu-kicker">${kicker}</div>
        <h1 id="overlay-title" class="ssg-main-menu-title">${
          isRecord
            ? "<span class='ssg-main-menu-title-line ssg-main-menu-title-line--bone'>RED</span><span class='ssg-main-menu-title-line ssg-main-menu-title-line--hot'>LINED</span>"
            : "DELIVERED"
        }</h1>
        <div id="overlay-grade" class="grade-${summary.grade.toLowerCase()}">
          <span class="grade-letter">${summary.grade}</span>
          <span class="grade-score">${summary.total} pts</span>
        </div>
      </div>
      <nav class="ssg-main-menu-nav" aria-label="Run summary">
        <div class="ssg-main-menu-nav__label">Summary</div>
        <div id="overlay-stats">
          <div class="stat"><span class="k">Time</span><span class="v ${records.newBestTime ? "gold" : ""}">${fmtTime(summary.time)}</span></div>
          <div class="stat"><span class="k">Score</span><span class="v ${records.newBestScore ? "gold" : ""}">${summary.total}</span></div>
          <div class="stat"><span class="k">Time bonus</span><span class="v">${summary.timeBonus}</span></div>
          <div class="stat"><span class="k">Embers · pts</span><span class="v">${summary.embers} · ${summary.emberPoints}</span></div>
          <div class="stat"><span class="k">Near-miss · pts</span><span class="v">${summary.nearMisses} · ${summary.stylePoints}</span></div>
          <div class="stat"><span class="k">Best · pts</span><span class="v">${bestTimeStr} · ${bestScoreStr}</span></div>
        </div>
        <button id="overlay-btn" class="ssg-main-menu-action ssg-main-menu-action--primary">
          <span class="ssg-main-menu-action__label"><span>RUN AGAIN</span></span>
          <span class="ssg-main-menu-action__meta">Beat the score</span>
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
