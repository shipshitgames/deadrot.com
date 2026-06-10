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
import { GameSettingsScreen, PauseMenu } from "@shipshitgames/ui";
import { useSyncExternalStore } from "react";
import { overlayController } from "./overlayController";

export function GameOverlays() {
  const state = useSyncExternalStore(overlayController.subscribe, overlayController.getState);

  return (
    <>
      {state.settingsOpen && (
        <GameSettingsScreen
          open
          onClose={() => overlayController.closeSettings()}
          kicker="Courier Settings"
          backgroundImage={menuHero}
        />
      )}

      <PauseMenu
        open={state.paused}
        kicker="Dead Road"
        title="Paused"
        subtitle="The lane holds its breath. Catch yours."
        onResume={overlayController.onResume}
        actions={overlayController.pauseActions}
      />
    </>
  );
}
