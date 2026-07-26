import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useRef, useState } from "react";
import { audio } from "../../audio/AudioEngine";
import type { Game } from "../../game/Game";
import { STICK_RADIUS } from "../../game/touchControls";
import type { HudState } from "../../game/types";

/**
 * The on-screen controls for phones and tablets.
 *
 * Left thumb drives a floating stick; the right thumb drags the canvas to look
 * and taps the action cluster. This component is only the *surface* — every
 * gesture is forwarded verbatim to {@link Game.touch}, which owns the maths and
 * the per-frame drain. Nothing here reads or writes game state directly.
 *
 * It renders nothing at all on a mouse-and-keyboard machine.
 */
export function TouchPad({ gameRef, state }: { gameRef: RefObject<Game | null>; state: HudState }) {
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const stickPointer = useRef<number | null>(null);
  const [aiming, setAiming] = useState(false);

  /**
   * The knob follows the thumb through direct style writes rather than React
   * state: it moves every pointermove (up to ~120 Hz on a modern phone), and
   * re-rendering the HUD that often would cost more than the whole input path.
   */
  const paint = useCallback((originX: number, originY: number, dx: number, dy: number, visible: boolean) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    const zone = stickZoneRef.current;
    if (!base || !knob || !zone) return;

    base.style.opacity = visible ? "1" : "0";
    knob.style.opacity = visible ? "1" : "0";
    if (!visible) return;

    const rect = zone.getBoundingClientRect();
    const localX = originX - rect.left;
    const localY = originY - rect.top;
    base.style.transform = `translate(${localX - STICK_RADIUS}px, ${localY - STICK_RADIUS}px)`;

    // Clamp the knob to the ring so it mirrors the saturation the intent applies.
    const dist = Math.hypot(dx, dy);
    const scale = dist > STICK_RADIUS ? STICK_RADIUS / dist : 1;
    knob.style.transform = `translate(${localX + dx * scale - 26}px, ${localY + dy * scale - 26}px)`;
  }, []);

  const onStickDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      audio.unlock();
      const touch = gameRef.current?.touch;
      if (!touch?.stickStart(e.pointerId, e.clientX, e.clientY)) return;
      stickPointer.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      paint(e.clientX, e.clientY, 0, 0, true);
    },
    [gameRef, paint],
  );

  const onStickMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (stickPointer.current !== e.pointerId) return;
      const touch = gameRef.current?.touch;
      if (!touch?.stickMove(e.pointerId, e.clientX, e.clientY)) return;
      const { origin } = touch.stickState();
      paint(origin.x, origin.y, e.clientX - origin.x, e.clientY - origin.y, true);
    },
    [gameRef, paint],
  );

  const onStickUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (stickPointer.current !== e.pointerId) return;
      stickPointer.current = null;
      gameRef.current?.touch.stickEnd(e.pointerId);
      paint(0, 0, 0, 0, false);
    },
    [gameRef, paint],
  );

  const onFireDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      audio.unlock();
      e.currentTarget.setPointerCapture(e.pointerId);
      gameRef.current?.touch.setFiring(true);
    },
    [gameRef],
  );

  const onFireUp = useCallback(() => gameRef.current?.touch.setFiring(false), [gameRef]);

  const onAds = useCallback(() => setAiming(gameRef.current?.touch.toggleAds() ?? false), [gameRef]);

  // The pad exists only while there is a game to play; menus, pause screens and
  // the game-over card have their own touch-friendly buttons.
  if (!gameRef.current?.touch.enabled || state.status !== "playing") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none" data-testid="touch-pad">
      {/* Movement — the whole lower-left quadrant, so the thumb never has to aim. */}
      <div
        ref={stickZoneRef}
        data-testid="touch-stick-zone"
        className="pointer-events-auto absolute bottom-0 left-0 h-1/2 w-1/2 touch-none"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div
          ref={baseRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-full border-2 border-white/25 bg-black/25 opacity-0 transition-opacity duration-150"
          style={{ width: STICK_RADIUS * 2, height: STICK_RADIUS * 2 }}
        />
        <div
          ref={knobRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 h-[52px] w-[52px] rounded-full border border-emerald-300/60 bg-emerald-400/30 opacity-0 transition-opacity duration-150"
        />
      </div>

      {/* Actions — right thumb. Fire sits lowest and largest; it is pressed most. */}
      <div className="pointer-events-none absolute right-3 bottom-4 flex flex-col items-end gap-3">
        <div className="flex items-center gap-3">
          <PadButton testId="touch-weapon" label="⇄" hint="Weapon" onTap={() => gameRef.current?.touch.cycleWeapon()} />
          <PadButton testId="touch-reload" label="⟳" hint="Reload" onTap={() => gameRef.current?.touch.reload()} />
        </div>
        <div className="flex items-center gap-3">
          <PadButton testId="touch-melee" label="🔪" hint="Melee" onTap={() => gameRef.current?.touch.melee()} />
          <PadButton testId="touch-jump" label="⤒" hint="Jump" onTap={() => gameRef.current?.touch.jump()} />
        </div>
        <div className="flex items-center gap-3">
          <PadButton testId="touch-ads" label="◎" hint="Aim" active={aiming} onTap={onAds} />
          <button
            type="button"
            data-testid="touch-fire"
            aria-label="Fire"
            className="pointer-events-auto h-24 w-24 touch-none rounded-full border-2 border-rose-300/60 bg-rose-500/30 font-bold text-2xl text-rose-50 active:bg-rose-500/60"
            onPointerDown={onFireDown}
            onPointerUp={onFireUp}
            onPointerCancel={onFireUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            ⦿
          </button>
        </div>
      </div>

      {/* Interact appears only when the player is actually facing something. */}
      {state.interactPrompt && (
        <button
          type="button"
          data-testid="touch-interact"
          className="pointer-events-auto -translate-x-1/2 absolute bottom-52 left-1/2 touch-none rounded-lg border border-amber-300/60 bg-amber-500/30 px-5 py-3 font-semibold text-amber-50 text-sm active:bg-amber-500/60"
          onPointerDown={() => gameRef.current?.touch.interact()}
        >
          {state.interactPrompt}
        </button>
      )}
    </div>
  );
}

function PadButton({
  testId,
  label,
  hint,
  active,
  onTap,
}: {
  testId: string;
  label: string;
  hint: string;
  active?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={hint}
      aria-pressed={active}
      className={`pointer-events-auto h-16 w-16 touch-none rounded-full border font-semibold text-lg ${
        active
          ? "border-emerald-200/80 bg-emerald-400/50 text-emerald-50"
          : "border-white/30 bg-black/35 text-white/85 active:bg-white/25"
      }`}
      // pointerdown rather than click: a tap that drifts a few pixels still
      // counts, and the action fires on press like every other control here.
      onPointerDown={onTap}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
