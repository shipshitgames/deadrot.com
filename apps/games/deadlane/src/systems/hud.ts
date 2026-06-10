import { CONSTANTS } from "../constants";
import { buildSpeedMul, runSpeedMul } from "../stats";
import type { GameState } from "../types";
import { patchBannerSnapshot } from "../ui/bannerBridge";

/**
 * HudSystem writes into the React-rendered HUD shell.
 * It keeps per-frame updates imperative so the game loop stays isolated.
 */
export class HudSystem {
  update(state: GameState): void {
    const tower = CONSTANTS.towers[state.selectedTower];
    patchBannerSnapshot({
      gold: String(state.gold),
      wave: `${Math.max(0, state.wave)} / ${CONSTANTS.waves.total}`,
      hp: String(state.baseHp),
      tower: `${tower.label} (${tower.cost})`,
      build: `${Math.round(buildSpeedMul(state) * 100)}%`,
      run: `${Math.round(runSpeedMul(state) * 100)}%`,
      hint: state.hintText,
    });
  }

  showBanner(title: string, sub: string, btn: string): void {
    patchBannerSnapshot({
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
    patchBannerSnapshot({ visible: false });
  }
}

function buttonMeta(label: string): string {
  if (label === "RUN IT BACK" || label === "TRY AGAIN") return "Restart";
  return "Start wave";
}
