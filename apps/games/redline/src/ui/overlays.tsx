/**
 * React overlay island for REDLINE.
 *
 * The game itself is imperative (Three.js + a DOM HUD), so the shared cinematic
 * overlays that need React — the Settings panel and the Pause menu — live here
 * and are driven through a tiny external store. The Game mutates the store; this
 * component subscribes and re-renders. Keeping it isolated means the game loop
 * never has to know about React internals.
 */

import { GlobalGameSettingsPanel, PauseMenu } from "@shipshitgames/ui";
import { useSyncExternalStore } from "react";
import { overlayController } from "./overlayController";

export function GameOverlays() {
  const state = useSyncExternalStore(overlayController.subscribe, overlayController.getState);

  return (
    <>
      {state.settingsOpen && (
        <dialog className="settings-overlay" open aria-modal="true" aria-label="Settings">
          <div className="settings-overlay__card">
            <div className="settings-overlay__head">
              <div>
                <div className="ssg-menu-kicker">Courier Settings</div>
                <h2 className="settings-overlay__title">Audio</h2>
              </div>
              <button
                type="button"
                className="settings-overlay__close"
                onClick={() => overlayController.closeSettings()}
              >
                Close
              </button>
            </div>
            <GlobalGameSettingsPanel inline />
          </div>
        </dialog>
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
