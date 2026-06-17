import type { FloatKind, FloatNumber, HudCore, HudExtension, HudHost, HudListener, Vector3 } from "./types";

/**
 * Genre-neutral HUD core extracted from Scourge Survivors. It owns the parts of
 * a heads-up display that every action game shares — monotonic feedback
 * channels, the centre banner / pickup toast, and world→screen floating combat
 * numbers — and delegates every game-specific field to a {@link HudExtension}.
 *
 * Each `emit()` assembles a {@link HudCore} frame from the universal core plus
 * `extension.read()` and hands it to the listener (usually a React `setState`).
 * Games subclass this and supply the host + extension, keeping their own state
 * machine and systems untouched.
 */
export class HudCoreSystem<E> {
  /** Seconds-since-last-emit accumulator games use to throttle HUD pushes. */
  emitAccumulator = 0;

  // Monotonic feedback channels — producers just `system.hitSeq++` then emit().
  hitSeq = 0;
  emphasisSeq = 0;
  killSeq = 0;
  damageSeq = 0;

  banner = "";
  bannerSeq = 0;
  toast = "";
  toastSeq = 0;

  /** Floating combat numbers, carrying a spawn time used only for TTL pruning. */
  private floats: (FloatNumber & { t: number })[] = [];
  private floatId = 0;

  /** Seconds a floating number lives before the HUD drops it. */
  static readonly DAMAGE_NUMBER_TTL = 0.9;
  /** Hard cap so a burst of hits can't grow the array without bound. */
  static readonly MAX_FLOATS = 40;

  constructor(
    private readonly host: HudHost,
    private readonly extension: HudExtension<E>,
    private readonly listener: HudListener<E>,
  ) {}

  /** Drop the current centre banner so a stale "VICTORY"/"DEFEAT" can't re-flash. */
  clearBanner(): void {
    this.banner = "";
    this.bannerSeq = 0;
  }

  /** Raise a centre-screen banner, fire its audio cue, and push a frame. */
  announce(text: string): void {
    this.banner = text;
    this.bannerSeq++;
    this.extension.onAnnounce?.(text);
    this.emit();
  }

  /** Raise a small pickup/status toast and push a frame. */
  showToast(text: string): void {
    this.toast = text;
    this.toastSeq++;
    this.emit();
  }

  /** Spawn a floating combat number at a world position, projected to screen %. */
  addDamageNumber(world: Vector3, amount: number, kind: FloatKind): void {
    const v = world.clone().project(this.host.camera);
    if (v.z > 1) return; // behind the camera — don't show
    const x = (v.x * 0.5 + 0.5) * 100;
    const y = (-v.y * 0.5 + 0.5) * 100;
    this.floats.push({
      id: ++this.floatId,
      x,
      y,
      amount: Math.max(1, Math.round(amount)),
      kind,
      t: this.host.time,
    });
    if (this.floats.length > HudCoreSystem.MAX_FLOATS) this.floats.shift();
  }

  /** Assemble a HUD frame from the universal core + the game extension. */
  emit(): void {
    if (this.host.disposed) return;
    // Drop floating numbers once their CSS animation has finished.
    if (this.floats.length) {
      this.floats = this.floats.filter((d) => this.host.time - d.t < HudCoreSystem.DAMAGE_NUMBER_TTL);
    }
    const frame = {
      ...this.extension.vitals(),
      hitSeq: this.hitSeq,
      emphasisSeq: this.emphasisSeq,
      killSeq: this.killSeq,
      damageSeq: this.damageSeq,
      banner: this.banner,
      bannerSeq: this.bannerSeq,
      toast: this.toast,
      toastSeq: this.toastSeq,
      damageNumbers: this.floats.map(({ t, ...d }) => d),
      ...this.extension.read(),
    } as HudCore<E>;
    this.listener(frame);
  }
}
