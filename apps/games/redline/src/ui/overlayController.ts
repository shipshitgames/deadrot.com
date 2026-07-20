import type { RedlineCinematicBeat } from "../cinematics";

export interface RedlineCinematicRequest {
  beat: RedlineCinematicBeat;
  site: string;
  complete: () => void;
}

export interface OverlayState {
  paused: boolean;
  settingsOpen: boolean;
  cinematic: RedlineCinematicRequest | null;
}

type Listener = () => void;

/**
 * Minimal external store the imperative Game can drive without importing React.
 */
class OverlayController {
  private state: OverlayState = { paused: false, settingsOpen: false, cinematic: null };
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

  showCinematic(cinematic: RedlineCinematicRequest) {
    this.set({ cinematic });
  }

  clearCinematic() {
    if (!this.state.cinematic) return;
    this.set({ cinematic: null });
  }
}

export const overlayController = new OverlayController();
