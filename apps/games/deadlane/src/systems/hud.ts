import { CONSTANTS } from "../constants";
import { buildSpeedMul, runSpeedMul } from "../stats";
import type { GameState } from "../types";
import { type BannerSnapshot, patchBannerSnapshot } from "../ui/bannerBridge";

const HUD_EMIT_INTERVAL = 0.1;
type GameplayHudSnapshot = Pick<BannerSnapshot, "gold" | "wave" | "hp" | "tower" | "build" | "run" | "hint">;

/**
 * HudSystem writes into the React-rendered HUD shell.
 * It keeps per-frame updates imperative so the game loop stays isolated.
 */
export class HudSystem {
  private lastPublished: GameplayHudSnapshot | null = null;
  private timeSincePublish = Number.POSITIVE_INFINITY;
  publicationCount = 0;

  update(state: GameState, frameDt = 0, force = false): void {
    this.timeSincePublish += frameDt;
    const tower = CONSTANTS.towers[state.selectedTower];
    const next: GameplayHudSnapshot = {
      gold: String(state.gold),
      wave: `${Math.max(0, state.wave)} / ${CONSTANTS.waves.total}`,
      hp: String(state.baseHp),
      tower: `${tower.label} (${tower.cost})`,
      build: `${Math.round(buildSpeedMul(state) * 100)}%`,
      run: `${Math.round(runSpeedMul(state) * 100)}%`,
      hint: state.hintText,
    };
    if (this.lastPublished && sameGameplaySnapshot(this.lastPublished, next)) return;
    if (!force && this.timeSincePublish < HUD_EMIT_INTERVAL) return;
    this.publish(next);
    this.lastPublished = next;
    this.timeSincePublish = 0;
  }

  showBanner(title: string, sub: string, btn: string): void {
    this.publish({
      visible: true,
      title,
      // Surface the canon lane name (e.g. "Ashgate — Eastern Lane") right next to
      // the "HOLD THE LANE" briefing text.
      subtitle: `${CONSTANTS.board.name} — ${sub}`,
      actionLabel: btn,
      actionMeta: buttonMeta(btn),
    });
  }

  hideBanner(): void {
    this.publish({ visible: false });
  }

  private publish(next: Partial<BannerSnapshot>): void {
    patchBannerSnapshot(next);
    this.publicationCount++;
  }
}

function sameGameplaySnapshot(a: GameplayHudSnapshot, b: GameplayHudSnapshot): boolean {
  return (
    a.gold === b.gold &&
    a.wave === b.wave &&
    a.hp === b.hp &&
    a.tower === b.tower &&
    a.build === b.build &&
    a.run === b.run &&
    a.hint === b.hint
  );
}

function buttonMeta(label: string): string {
  if (label === "RUN IT BACK" || label === "TRY AGAIN") return "Restart";
  return "Start wave";
}
