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

export interface OverlayState {
  paused: boolean;
  settingsOpen: boolean;
}

type Listener = () => void;

/**
 * Minimal external store the imperative Game can drive without importing React.
 */
class OverlayController {
  private state: OverlayState = { paused: false, settingsOpen: false };
  private readonly listeners = new Set<Listener>();

  /** Secondary pause actions (Restart / Exit to title), wired by the Game. */
  pauseActions: { id: string; label: string; meta?: string; onSelect: () => void }[] = [];
  /** Resume callback, wired by the Game. */
  onResume: () => void = () => {};

  getState = (): OverlayState => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<OverlayState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  setPaused(paused: boolean) {
    this.set({ paused });
  }

  openSettings() {
    this.set({ settingsOpen: true });
  }

  closeSettings() {
    this.set({ settingsOpen: false });
  }
}

export const overlayController = new OverlayController();

export function GameOverlays() {
  const state = useSyncExternalStore(overlayController.subscribe, overlayController.getState);

  return (
    <>
      {state.settingsOpen && (
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
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
        </div>
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
