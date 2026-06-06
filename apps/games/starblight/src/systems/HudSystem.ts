import type { HudState } from "../game/types";
import type { UpgradeId } from "../game/upgrades";

// Binds the React-rendered HUD shell to game state with cached element refs and
// dirty-checked writes. Draft cards and build tray still update imperatively.
export class HudSystem {
  private levelEl = byId("level");
  private xpFill = byId("xp-fill");
  private timerEl = byId("timer");
  private salvageEl = byId("salvage");
  private killsEl = byId("kills");
  private bossBar = byId("boss-bar");
  private bossFill = byId("boss-fill");
  private intFill = byId("int-fill");
  private intText = byId("int-text");
  private buildTray = byId("build-tray");
  private pauseBtn = byId("pause-btn") as HTMLButtonElement;
  private banner = byId("banner");
  private bannerTitle = byId("banner-title");
  private bannerSub = byId("banner-sub");
  private bannerHint = byId("banner-hint");
  private bannerBtn = byId("banner-btn") as HTMLButtonElement;
  private pauseMenu = byId("pause-menu");
  private pauseStats = byId("pause-stats");
  private pauseResume = byId("pause-resume") as HTMLButtonElement;
  private pauseRestart = byId("pause-restart") as HTMLButtonElement;
  private pauseTitle = byId("pause-title-btn") as HTMLButtonElement;
  private draft = byId("draft");
  private draftCards = byId("draft-cards");
  private flash = byId("flash");
  private vignette = byId("vignette");

  private lastStat = "";
  private lastBuild = "";
  private lastDraft = "";
  private lastPhase = "";
  private lastLevel = 1;

  private readonly onBtnClick = () => this.onStart();
  private readonly onPauseClick = () => this.onPause();
  private readonly onResumeClick = () => this.onResume();
  private readonly onRestartClick = () => this.onRestart();
  private readonly onTitleClick = () => this.onTitle();

  constructor(
    private readonly onStart: () => void,
    private readonly onPick: (id: UpgradeId) => void,
    private readonly onPause: () => void,
    private readonly onResume: () => void,
    private readonly onRestart: () => void,
    private readonly onTitle: () => void,
  ) {
    this.bannerBtn.addEventListener("click", this.onBtnClick);
    this.pauseBtn.addEventListener("click", this.onPauseClick);
    this.pauseResume.addEventListener("click", this.onResumeClick);
    this.pauseRestart.addEventListener("click", this.onRestartClick);
    this.pauseTitle.addEventListener("click", this.onTitleClick);
  }

  dispose() {
    this.bannerBtn.removeEventListener("click", this.onBtnClick);
    this.pauseBtn.removeEventListener("click", this.onPauseClick);
    this.pauseResume.removeEventListener("click", this.onResumeClick);
    this.pauseRestart.removeEventListener("click", this.onRestartClick);
    this.pauseTitle.removeEventListener("click", this.onTitleClick);
    if (this.flashTimer) window.clearTimeout(this.flashTimer);
  }

  update(s: HudState) {
    // Continuous bars.
    this.xpFill.style.width = `${Math.round(s.xp01 * 100)}%`;
    this.intFill.style.width = `${Math.round((s.integrity / Math.max(1, s.maxIntegrity)) * 100)}%`;

    // Level-up flash when the level number ticks up mid-run.
    if (s.level > this.lastLevel && s.phase !== "title") this.pulseFlash();
    this.lastLevel = s.level;

    // Discrete stats (dirty-checked to avoid layout churn).
    const statKey = `${s.level}|${Math.floor(s.timeSec)}|${s.integrity}|${s.maxIntegrity}|${s.gems}|${s.kills}|${s.bossHp01 ?? -1}`;
    if (statKey !== this.lastStat) {
      this.lastStat = statKey;
      this.levelEl.textContent = String(s.level);
      this.timerEl.textContent = fmtTime(s.timeSec);
      this.salvageEl.textContent = s.gems.toLocaleString();
      this.killsEl.textContent = `${s.kills} kills`;
      this.intText.textContent = `${s.integrity}/${s.maxIntegrity}`;
      this.pauseStats.textContent = `${fmtTime(s.timeSec)} - LVL ${s.level} - ${s.kills} kills`;
      if (s.bossHp01 == null) {
        this.bossBar.classList.add("hidden");
      } else {
        this.bossBar.classList.remove("hidden");
        this.bossFill.style.width = `${Math.round(s.bossHp01 * 100)}%`;
      }
    }

    // Low-integrity danger vignette.
    this.vignette.classList.toggle("show", s.lowIntegrity);

    // Build tray.
    const buildKey = s.build.map((b) => `${b.id}${b.level}`).join(",");
    if (buildKey !== this.lastBuild) {
      this.lastBuild = buildKey;
      this.renderBuild(s);
    }

    // Phase-driven overlays.
    if (s.phase !== this.lastPhase) {
      this.lastPhase = s.phase;
      this.renderBanner(s);
      this.renderPause(s);
    }

    // Draft overlay.
    const draftKey = s.draft ? s.draft.map((c) => `${c.id}${c.level}`).join(",") : "";
    if (draftKey !== this.lastDraft) {
      this.lastDraft = draftKey;
      this.renderDraft(s);
    }
  }

  private renderBuild(s: HudState) {
    this.buildTray.innerHTML = "";
    for (const b of s.build) {
      const chip = document.createElement("div");
      chip.className = `chip ${b.kind}${b.level >= b.max ? " maxed" : ""}`;
      chip.title = `${b.name} — Lv ${b.level}/${b.max}`;
      chip.innerHTML = `<span class="chip-icon">${b.icon}</span><span class="chip-lv">${b.level}</span>`;
      this.buildTray.appendChild(chip);
    }
  }

  private renderDraft(s: HudState) {
    if (!s.draft) {
      this.draft.classList.add("hidden");
      this.draftCards.innerHTML = "";
      return;
    }
    this.draft.classList.remove("hidden");
    this.draftCards.innerHTML = "";
    s.draft.forEach((c, i) => {
      const isNew = c.level === 0;
      const card = document.createElement("button");
      card.className = `ssg-upgrade-card card ${c.kind}`;
      card.innerHTML = `
        <div class="card-key">${i + 1}</div>
        <div class="card-icon ssg-upgrade-card__icon">${c.icon}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-lv">${isNew ? '<span class="new">NEW</span>' : `LVL ${c.level} -> ${c.level + 1}`}</div>
        <div class="card-desc">${c.desc}</div>`;
      card.addEventListener("click", () => this.onPick(c.id));
      this.draftCards.appendChild(card);
    });
  }

  private renderBanner(s: HudState) {
    const showDraft = s.phase === "levelup";
    if (!showDraft) this.draft.classList.add("hidden");

    if (s.phase === "title") {
      this.banner.classList.remove("hidden");
      this.bannerTitle.innerHTML =
        '<span class="ssg-main-menu-title-line ssg-main-menu-title-line--bone">STAR</span><span class="ssg-main-menu-title-line ssg-main-menu-title-line--hot">BLIGHT</span>';
      this.bannerSub.textContent = "THE ORBITAL FRONT";
      this.bannerHint.innerHTML =
        "MOVE WITH THE MOUSE &nbsp;&bull;&nbsp; weapons auto-fire &nbsp;&bull;&nbsp; collect gems, draft upgrades, stack combos";
      this.setBannerButton("ENGAGE", "Start sortie");
      this.bannerBtn.classList.remove("hidden");
    } else if (s.phase === "gameover") {
      this.banner.classList.remove("hidden");
      this.bannerTitle.textContent = "OVERRUN";
      this.bannerSub.textContent = `t=${fmtTime(s.timeSec)} · LVL ${s.level} · ${s.kills} burned`;
      this.bannerHint.innerHTML = "The Scourge breached the line.";
      this.setBannerButton("RE-ENGAGE", "Retry run");
      this.bannerBtn.classList.remove("hidden");
    } else if (s.phase === "victory") {
      this.banner.classList.remove("hidden");
      this.bannerTitle.textContent = "FRONT HELD";
      this.bannerSub.textContent = `The Blight-Maw is burned · t=${fmtTime(s.timeSec)} · LVL ${s.level}`;
      this.bannerHint.innerHTML = "The orbital front holds — for now.";
      this.setBannerButton("FLY AGAIN", "Launch again");
      this.bannerBtn.classList.remove("hidden");
    } else {
      this.banner.classList.add("hidden");
    }
  }

  private setBannerButton(label: string, meta: string) {
    this.bannerBtn.innerHTML = `<span class="ssg-main-menu-action__label"><span>${label}</span></span><span class="ssg-main-menu-action__meta">${meta}</span>`;
  }

  private renderPause(s: HudState) {
    this.pauseBtn.classList.toggle("hidden", s.phase !== "playing");
    this.pauseMenu.classList.toggle("hidden", s.phase !== "paused");
  }

  private flashTimer = 0;
  private pulseFlash() {
    this.flash.classList.add("show");
    if (this.flashTimer) window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.flash.classList.remove("show"), 180);
  }
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`HUD element #${id} not found`);
  return el;
}
