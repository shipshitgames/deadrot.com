/**
 * React overlay island for REDLINE.
 *
 * The game itself is imperative (Three.js + a DOM HUD), so the shared cinematic
 * overlays that need React — the Settings panel and the Pause menu — live here
 * and are driven through a tiny external store. The Game mutates the store; this
 * component subscribes and re-renders. Keeping it isolated means the game loop
 * never has to know about React internals.
 */

import menuHero from "@shipshitgames/assets/games/redline/ui/menu/title.webp";
import { GameAudioSettingsScreen, GamePauseMenu } from "@shipshitgames/ui";
import { useSyncExternalStore } from "react";
import { overlayController } from "./overlayController";

const GAME_SLUG = "redline";

export function GameOverlays() {
  const state = useSyncExternalStore(overlayController.subscribe, overlayController.getState);

  return (
    <>
      {state.settingsOpen && (
        <GameAudioSettingsScreen
          open
          slug={GAME_SLUG}
          onClose={() => overlayController.closeSettings()}
          backgroundImage={menuHero}
        />
      )}

      <GamePauseMenu
        slug={GAME_SLUG}
        open={state.paused}
        onResume={overlayController.onResume}
        actions={overlayController.pauseActions}
      />
    </>
  );
}
