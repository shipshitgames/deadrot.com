import { CONSTANTS } from "../constants";
import type { GameState } from "../types";

/**
 * HudSystem writes into the React-rendered HUD shell.
 * It keeps per-frame updates imperative so the game loop stays isolated.
 */
export class HudSystem {
  private readonly gold = byId("stat-gold");
  private readonly wave = byId("stat-wave");
  private readonly hp = byId("stat-hp");
  private readonly hint = byId("hint-text");

  private readonly banner = byId("hud-banner");
  private readonly bannerTitle = byId("banner-title");
  private readonly bannerSub = byId("banner-sub");
  readonly bannerBtn = byId("banner-btn") as HTMLButtonElement;

  update(state: GameState): void {
    this.gold.textContent = String(state.gold);
    this.wave.textContent = `${Math.max(0, state.wave)} / ${CONSTANTS.waves.total}`;
    this.hp.textContent = String(state.baseHp);

    const cost = CONSTANTS.economy.towerCost;
    if (state.phase === "building" || state.phase === "wave") {
      this.hint.textContent =
        state.gold >= cost
          ? `CLICK A CELL TO BUILD (COST ${cost})`
          : `NOT ENOUGH GOLD — KILL THE SCOURGE (NEED ${cost})`;
    }
  }

  showBanner(title: string, sub: string, btn: string): void {
    this.bannerTitle.innerHTML = formatTitle(title);
    // Surface the canon lane name (e.g. "Ashgate — Eastern Lane") right next to
    // the "HOLD THE LANE" briefing text.
    this.bannerSub.textContent = `${CONSTANTS.board.name} — ${sub}`;
    this.bannerBtn.innerHTML = `<span class="ssg-main-menu-action__label"><span>${btn}</span></span><span class="ssg-main-menu-action__meta">${buttonMeta(btn)}</span>`;
    this.banner.classList.remove("hidden");
  }

  hideBanner(): void {
    this.banner.classList.add("hidden");
  }
}

function formatTitle(title: string): string {
  if (title === "DEADLANE") {
    return '<span class="ssg-main-menu-title-line ssg-main-menu-title-line--bone">DEAD</span><span class="ssg-main-menu-title-line ssg-main-menu-title-line--hot">LANE</span>';
  }
  return title;
}

function buttonMeta(label: string): string {
  if (label === "RUN IT BACK" || label === "TRY AGAIN") return "Restart";
  return "Start wave";
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`HUD element #${id} not found`);
  return el;
}
