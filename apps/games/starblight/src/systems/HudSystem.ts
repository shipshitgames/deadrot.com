import { subscribeGlobalGameSettings } from "@shipshitgames/ui";
import { CONSTANTS } from "../game/constants";
import type { MarqueeImpact } from "../game/feedback";
import type { HudState } from "../game/types";
import type { UpgradeId } from "../game/upgrades";
import { publishMenu } from "../ui/gameBridge";
import { menuSnapshotFromHud } from "../ui/menuState";

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
  private draft = byId("draft");
  private draftCards = byId("draft-cards");
  private flash = byId("flash");
  private vignette = byId("vignette");

  private lastStat = "";
  private lastBuild = "";
  private lastDraft = "";
  private lastLevel = 1;
  private flashLevel = 1;
  private unsubscribeSettings: () => void = () => {};

  private readonly onPauseClick = () => this.onPause();

  // The pause overlay (Resume / Restart / Main Menu) is the shared React
  // PauseMenu now — those callbacks reach it through the gameBridge instead.
  constructor(
    private readonly onPick: (id: UpgradeId) => void,
    private readonly onPause: () => void,
  ) {
    this.pauseBtn.addEventListener("click", this.onPauseClick);
    this.unsubscribeSettings = subscribeGlobalGameSettings((settings) => {
      this.flashLevel = settings.effectLevels.flash;
    });
  }

  dispose() {
    this.pauseBtn.removeEventListener("click", this.onPauseClick);
    this.unsubscribeSettings();
    if (this.flashTimer) window.clearTimeout(this.flashTimer);
  }

  update(s: HudState) {
    // Continuous bars.
    this.xpFill.style.width = `${Math.round(s.xp01 * 100)}%`;
    this.intFill.style.width = `${Math.round((s.integrity / Math.max(1, s.maxIntegrity)) * 100)}%`;

    // Level-up flash when the level number ticks up mid-run.
    if (s.level > this.lastLevel && s.phase !== "title") this.pulseFlash(CONSTANTS.fx.flash.levelUp);
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

    // React owns title / pause / results / meta. The bridge discards duplicate
    // live-play snapshots, so this remains cheap when update() runs each frame.
    publishMenu(menuSnapshotFromHud(s));
    this.pauseBtn.classList.toggle("hidden", s.phase !== "playing");
    if (s.phase !== "levelup") this.draft.classList.add("hidden");

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

  private flashTimer = 0;
  pulseImpact(impact: MarqueeImpact) {
    this.pulseFlash(CONSTANTS.fx.flash[impact]);
  }

  private pulseFlash(preset: { durationMs: number; opacity: number }) {
    if (this.flashLevel <= 0) return;
    this.flash.style.setProperty("--flash-opacity", String(preset.opacity * this.flashLevel));
    this.flash.classList.add("show");
    if (this.flashTimer) window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.flash.classList.remove("show"), preset.durationMs);
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
