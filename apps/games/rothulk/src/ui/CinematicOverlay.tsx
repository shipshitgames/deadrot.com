import { useCallback, useEffect, useRef } from "react";
import type { RothulkCinematicBeat } from "../game/data/cinematics";

interface CinematicOverlayProps {
  beat: RothulkCinematicBeat;
  site: string;
  onComplete: () => void;
}

export function CinematicOverlay({ beat, site, onComplete }: CinematicOverlayProps) {
  const completedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

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
      className={`rothulk-cinematic rothulk-cinematic--${beat.tone}`}
      data-testid={`cinematic-${beat.slot}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${beat.kicker}: ${beat.title}`}
      tabIndex={-1}
      onPointerDown={(event) => {
        event.preventDefault();
        complete();
      }}
    >
      <div className="rothulk-cinematic__wash" aria-hidden />
      <div className="rothulk-cinematic__gash rothulk-cinematic__gash--top" aria-hidden />
      <div className="rothulk-cinematic__gash rothulk-cinematic__gash--bottom" aria-hidden />
      <div className="rothulk-cinematic__frame">
        <div className="rothulk-cinematic__site">{site}</div>
        <div className="rothulk-cinematic__kicker">{beat.kicker}</div>
        <h2>{beat.title}</h2>
        <p>{beat.body}</p>
        <div className="rothulk-cinematic__signal">{beat.signal}</div>
        <button type="button" onClick={complete}>
          {beat.slot === "intro" ? "Enter the hulk" : "Continue"} <span>Any input skips</span>
        </button>
      </div>
      <div className="rothulk-cinematic__timer" aria-hidden>
        <i style={{ animationDuration: `${beat.durationMs}ms` }} />
      </div>
    </div>
  );
}
