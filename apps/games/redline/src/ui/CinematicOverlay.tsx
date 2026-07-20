import { useCallback, useEffect, useRef } from "react";
import type { RedlineCinematicBeat } from "../cinematics";

interface CinematicOverlayProps {
  beat: RedlineCinematicBeat;
  site: string;
  onComplete: () => void;
}

export function CinematicOverlay({ beat, site, onComplete }: CinematicOverlayProps) {
  const completedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const flowSafe = beat.slot === "intro" || beat.slot === "transition";

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    overlayRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(complete, beat.durationMs);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      complete();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [beat.durationMs, beat.id, complete]);

  return (
    <div
      ref={overlayRef}
      className={`redline-cinematic redline-cinematic--${beat.tone} ${flowSafe ? "redline-cinematic--flow-safe" : ""}`}
      data-testid={`cinematic-${beat.slot}`}
      role="dialog"
      aria-modal={!flowSafe}
      aria-label={`${beat.kicker}: ${beat.title}`}
      tabIndex={-1}
      onPointerDown={(event) => {
        event.preventDefault();
        complete();
      }}
    >
      <div className="redline-cinematic__speed" aria-hidden />
      <div className="redline-cinematic__frame">
        <div className="redline-cinematic__site">{site}</div>
        <div className="redline-cinematic__kicker">{beat.kicker}</div>
        <h2>{beat.title}</h2>
        <p>{beat.body}</p>
        <div className="redline-cinematic__signal">{beat.signal}</div>
        <button type="button" onClick={complete}>
          {flowSafe ? "Run the lane" : "Continue"} <span>Any input skips</span>
        </button>
      </div>
      <div className="redline-cinematic__timer" aria-hidden>
        <i style={{ animationDuration: `${beat.durationMs}ms` }} />
      </div>
    </div>
  );
}
