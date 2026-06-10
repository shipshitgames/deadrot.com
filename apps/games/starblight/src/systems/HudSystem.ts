import type { HudState } from "../game/types";
import type { UpgradeId } from "../game/upgrades";
import { publishPause } from "../ui/gameBridge";

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
  private draft = byId("draft");
  private draftCards = byId("draft-cards");
  private flash = byId("flash");
  private vignette = byId("vignette");

  private lastStat = "";
  private lastBuild = "";
  private lastDraft = "";
  private lastPhase = "";
  private lastLevel = 1;
  private pauseStatsText = "0:00 - LVL 1 - 0 kills";

  private readonly onBtnClick = () => this.onStart();
  private readonly onPauseClick = () => this.onPause();

  // The pause overlay (Resume / Restart / Main Menu) is the shared React
  // PauseMenu now — those callbacks reach it through the gameBridge instead.
  constructor(
    private readonly onStart: () => void,
    private readonly onPick: (id: UpgradeId) => void,
    private readonly onPause: () => void,
  ) {
    this.bannerBtn.addEventListener("click", this.onBtnClick);
    this.pauseBtn.addEventListener("click", this.onPauseClick);
  }

  dispose() {
    this.bannerBtn.removeEventListener("click", this.onBtnClick);
    this.pauseBtn.removeEventListener("click", this.onPauseClick);
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
      this.pauseStatsText = `${fmtTime(s.timeSec)} - LVL ${s.level} - ${s.kills} kills`;
      // Keep the (open) overlay's status line live as the run clock ticks.
      if (s.phase === "paused") publishPause({ open: true, stats: this.pauseStatsText, phase: s.phase });
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
      const badgeClass = isNew ? "ssg-upgrade-card__badge ssg-upgrade-card__badge--new" : "ssg-upgrade-card__badge";
      const tip = c.desc.replace(/"/g, "&quot;");
      const card = document.createElement("button");
      card.className = "ssg-upgrade-card";
      card.innerHTML = `
        <span class="ssg-upgrade-card__key">${i + 1}</span>
        <span class="${badgeClass}">${isNew ? "NEW" : `LV ${c.level + 1}`}</span>
        <span class="ssg-upgrade-card__plaque" data-tip="${tip}">${c.icon}</span>
        <b class="ssg-upgrade-card__title">${c.name}</b>
        <span class="ssg-upgrade-card__desc">${c.desc}</span>`;
      card.addEventListener("click", () => this.onPick(c.id));
      this.draftCards.appendChild(card);
    });
  }

  private renderBanner(s: HudState) {
    const showDraft = s.phase === "levelup";
    if (!showDraft) this.draft.classList.add("hidden");

    if (s.phase === "title") {
      this.banner.classList.remove("hidden");
      this.bannerBtn.classList.remove("hidden");
    } else if (s.phase === "gameover") {
      this.banner.classList.remove("hidden");
      this.bannerTitle.textContent = "OVERRUN";
      this.bannerSub.textContent = `t=${fmtTime(s.timeSec)} · LVL ${s.level} · ${s.kills} burned`;
      this.bannerHint.innerHTML = "The Scourge breached the line.";
      this.setBannerButton("Re-engage", "Retry run");
      this.bannerBtn.classList.remove("hidden");
    } else if (s.phase === "victory") {
      this.banner.classList.remove("hidden");
      this.bannerTitle.textContent = "FRONT HELD";
      this.bannerSub.textContent = `The Blight-Maw is burned · t=${fmtTime(s.timeSec)} · LVL ${s.level}`;
      this.bannerHint.innerHTML = "The orbital front holds — for now.";
      this.setBannerButton("Fly again", "Launch again");
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
    // The pause overlay itself is the shared React PauseMenu, driven via the bridge.
    publishPause({ open: s.phase === "paused", stats: this.pauseStatsText, phase: s.phase });
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
