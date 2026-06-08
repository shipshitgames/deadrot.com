import type { CSSProperties } from "react";
import { useMemo } from "react";
import { cn } from "./cn";

/** Casino-floor palette — gold-heavy with ember/blood/bone/toxic accents. */
const CASINO_COLORS = ["#ffd166", "#ffb02e", "#ff6a00", "#ff2a18", "#e9e3d6", "#8bdc1f"];

export interface PixelConfettiProps {
  className?: string;
  /** Number of confetti pieces. */
  count?: number;
  /** Override the palette. */
  colors?: string[];
  /**
   * Bump this to re-roll the burst (e.g. each new level-up). The pieces are
   * memoised, so a changing seed forces a fresh random layout.
   */
  seed?: number | string;
}

/**
 * A non-interactive layer of chunky, pixelated confetti that rains across its
 * positioned parent — built for the upgrade draft "jackpot" moment. Pure CSS
 * animation; mounts/unmounts with whatever overlay renders it.
 */
export function PixelConfetti({ className, count = 60, colors = CASINO_COLORS, seed = 0 }: PixelConfettiProps) {
  const bits = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = 5 + Math.floor(Math.random() * 9); // 5–13px chunky blocks
      return {
        key: `${seed}-${i}`,
        left: Math.random() * 100,
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: -Math.random() * 5,
        dur: 2.4 + Math.random() * 3,
        drift: Math.round((Math.random() * 2 - 1) * 60),
        rot0: Math.round(Math.random() * 360),
        spin: (Math.random() < 0.5 ? -1 : 1) * (320 + Math.round(Math.random() * 540)),
        tall: Math.random() < 0.35, // some pieces are pixel "ribbons"
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed, colors]);

  return (
    <div className={cn("ssg-confetti", className)} aria-hidden="true">
      {bits.map((b) => (
        <i
          key={b.key}
          className="ssg-confetti__bit"
          style={
            {
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.tall ? b.size * 2 : b.size}px`,
              background: b.color,
              "--ssg-confetti-dur": `${b.dur}s`,
              "--ssg-confetti-delay": `${b.delay}s`,
              "--ssg-confetti-drift": `${b.drift}px`,
              "--ssg-confetti-rot0": `${b.rot0}deg`,
              "--ssg-confetti-spin": `${b.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
