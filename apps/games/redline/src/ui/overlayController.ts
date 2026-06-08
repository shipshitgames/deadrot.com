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
