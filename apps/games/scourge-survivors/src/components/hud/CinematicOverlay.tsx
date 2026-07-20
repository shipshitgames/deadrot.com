import { useCallback, useEffect, useRef } from "react";
import type { CinematicBeat } from "../../game/data/cinematics";

export function CinematicOverlay({
  beat,
  site,
  onComplete,
}: {
  beat: CinematicBeat;
  site: string;
  onComplete: () => void;
}) {
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
      className={`scourge-cinematic scourge-cinematic--${beat.tone}`}
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
      <div className="scourge-cinematic__wash" aria-hidden />
      <div className="scourge-cinematic__slash scourge-cinematic__slash--left" aria-hidden />
      <div className="scourge-cinematic__slash scourge-cinematic__slash--right" aria-hidden />
      <div className="scourge-cinematic__frame">
        <div className="scourge-cinematic__site">{site}</div>
        <div className="scourge-cinematic__kicker">{beat.kicker}</div>
        <h2>{beat.title}</h2>
        <p>{beat.body}</p>
        <div className="scourge-cinematic__signal">{beat.signal}</div>
        <button type="button" onClick={complete}>
          {beat.slot === "intro" ? "Enter breach" : "Continue"} <span>Any input skips</span>
        </button>
      </div>
      <div className="scourge-cinematic__timer" aria-hidden>
        <i style={{ animationDuration: `${beat.durationMs}ms` }} />
      </div>
    </div>
  );
}
