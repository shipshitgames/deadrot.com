export const FRAME_BUDGET_MS = 1000 / 60;
export const HUD_EMIT_INTERVAL_SEC = 0.1;

export type FramePhase = "flight" | "directorAi" | "weapons" | "collisions" | "gems" | "render";

export interface FrameProfileSnapshot {
  fps: number;
  frameMs: number;
  phases: Record<FramePhase, number>;
  drawCalls: number;
  triangles: number;
  hudHz: number;
  hudEmits: number;
}

const PHASES: readonly FramePhase[] = ["flight", "directorAi", "weapons", "collisions", "gems", "render"];
const SAMPLE_WINDOW_MS = 500;

/** Fixed-rate gate used to keep immutable HUD snapshots near 10Hz. */
export class HudEmitGate {
  private accumulator = 0;

  constructor(private readonly interval = HUD_EMIT_INTERVAL_SEC) {}

  advance(seconds: number): boolean {
    this.accumulator += seconds;
    if (this.accumulator < this.interval) return false;
    this.accumulator %= this.interval;
    return true;
  }

  reset(): void {
    this.accumulator = 0;
  }
}

/**
 * Dev-only rolling profiler. Disabled calls are constant-time guards; enabled
 * samples are averaged before touching the DOM so the overlay itself does not
 * become part of every frame's layout work.
 */
export class FrameBudgetProfiler {
  private enabled = false;
  private frameStartedAt = 0;
  private windowStartedAt = 0;
  private frameTotal = 0;
  private frameCount = 0;
  private lastHudEmits = 0;
  private hudBaselinePending = false;
  private readonly phaseTotals = new Float64Array(PHASES.length);
  private overlay: HTMLPreElement | null = null;
  private latest: FrameProfileSnapshot | null = null;

  constructor(
    private readonly devMode: boolean,
    initiallyEnabled = false,
  ) {
    this.setEnabled(initiallyEnabled);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this.enabled = this.devMode && enabled;
    this.resetWindow(performance.now(), this.lastHudEmits);
    this.hudBaselinePending = this.enabled;
    if (this.enabled) {
      this.latest = null;
      this.ensureOverlay();
      if (this.overlay) this.overlay.textContent = "FRAME PROFILER — collecting samples…";
    }
    if (this.overlay) this.overlay.hidden = !this.enabled;
    return this.enabled;
  }

  toggle(): boolean {
    return this.setEnabled(!this.enabled);
  }

  beginFrame(now: number, hudEmits: number): void {
    if (!this.enabled) return;
    if (this.hudBaselinePending) {
      this.lastHudEmits = hudEmits;
      this.hudBaselinePending = false;
    }
    this.frameStartedAt = now;
    if (this.windowStartedAt === 0) this.windowStartedAt = now;
  }

  beginPhase(): number {
    return this.enabled ? performance.now() : 0;
  }

  endPhase(phase: FramePhase, startedAt: number): void {
    if (!this.enabled) return;
    this.phaseTotals[PHASES.indexOf(phase)] += performance.now() - startedAt;
  }

  endFrame(now: number, renderer: { calls: number; triangles: number }, hudEmits: number): FrameProfileSnapshot | null {
    if (!this.enabled) return null;
    this.frameTotal += now - this.frameStartedAt;
    this.frameCount++;

    const elapsed = now - this.windowStartedAt;
    if (elapsed < SAMPLE_WINDOW_MS) return null;

    const frameCount = Math.max(1, this.frameCount);
    const seconds = elapsed / 1000;
    const phases = {} as Record<FramePhase, number>;
    for (let i = 0; i < PHASES.length; i++) phases[PHASES[i]] = this.phaseTotals[i] / frameCount;
    this.latest = {
      fps: frameCount / seconds,
      frameMs: this.frameTotal / frameCount,
      phases,
      drawCalls: renderer.calls,
      triangles: renderer.triangles,
      hudHz: (hudEmits - this.lastHudEmits) / seconds,
      hudEmits,
    };
    if (this.overlay) this.overlay.textContent = formatFrameProfile(this.latest);
    this.resetWindow(now, hudEmits);
    return this.latest;
  }

  snapshot(): FrameProfileSnapshot | null {
    return this.latest;
  }

  dispose(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private ensureOverlay(): void {
    if (this.overlay || typeof document === "undefined") return;
    const overlay = document.createElement("pre");
    overlay.id = "frame-budget-profiler";
    overlay.setAttribute("aria-live", "off");
    overlay.textContent = "FRAME PROFILER — collecting samples…";
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private resetWindow(now: number, hudEmits: number): void {
    this.windowStartedAt = now;
    this.frameTotal = 0;
    this.frameCount = 0;
    this.lastHudEmits = hudEmits;
    this.hudBaselinePending = false;
    this.phaseTotals.fill(0);
  }
}

export function formatFrameProfile(snapshot: FrameProfileSnapshot): string {
  const p = snapshot.phases;
  return [
    `FRAME ${snapshot.frameMs.toFixed(2)} / ${FRAME_BUDGET_MS.toFixed(1)} ms  ${snapshot.fps.toFixed(0)} FPS`,
    `flight      ${p.flight.toFixed(2)} ms`,
    `director+AI ${p.directorAi.toFixed(2)} ms`,
    `weapons     ${p.weapons.toFixed(2)} ms`,
    `collisions  ${p.collisions.toFixed(2)} ms`,
    `gems+FX     ${p.gems.toFixed(2)} ms`,
    `render      ${p.render.toFixed(2)} ms`,
    `draw ${snapshot.drawCalls}  tris ${snapshot.triangles.toLocaleString()}`,
    `HUD ${snapshot.hudHz.toFixed(1)} Hz  emits ${snapshot.hudEmits}`,
    "` toggle  ·  window.__game.stress()",
  ].join("\n");
}
