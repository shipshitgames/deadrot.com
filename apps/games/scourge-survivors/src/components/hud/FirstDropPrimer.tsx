import { useEffect, useState } from "react";
import { MELEE_WEAPON_NAME } from "../../game/constants";
import { markPrimerSeen, primerSeen } from "../../game/storage";
import type { HudState } from "../../game/types";

/**
 * First-drop onboarding: a corner card that tells a brand-new player what the
 * run wants from them and which keys do it, then gets out of the way.
 *
 * Controls otherwise live only behind Esc → Controls, which a first-timer has
 * no reason to open — so the one thing they need in the opening seconds is the
 * one thing they have to go looking for. This closes that gap without a modal:
 * it never takes pointer events, never pauses the run, and never appears twice
 * (see {@link primerSeen}).
 */

/** Seconds of live run time the card stays up before it fades itself out. */
const PRIMER_SECONDS = 14;
/** Seconds of that budget spent fading, so it leaves rather than blinks out. */
const FADE_SECONDS = 3;

/** Only the keys a player cannot finish their first thirty seconds without. */
const PRIMER_KEYS: [key: string, action: string][] = [
  ["WASD", "Move"],
  ["Mouse", "Look"],
  ["L-Click", "Fire"],
  ["R-Click", "Aim"],
  ["Shift", "Sprint"],
  ["Space", "Jump"],
  ["R", "Reload"],
  ["E", "Doors · Stairs"],
  ["F", MELEE_WEAPON_NAME],
];

/** The one sentence that says what winning this particular run looks like. */
function objectiveFor(state: HudState): string {
  if (state.campaign && state.missionObjective) return state.missionObjective;
  if (state.survivors && state.survivorChapterName) return `Survive — ${state.survivorChapterName}`;
  if (state.multiplayer) return "Outscore the room";
  return "Clear the Scourge — stay alive";
}

export function FirstDropPrimer({ state }: { state: HudState }) {
  const { status, time } = state;
  // Read the flag once on mount: marking it seen mid-run must not yank the card
  // out from under the player who is still reading it.
  const [seenBefore] = useState(primerSeen);

  // Latch rather than derive. Restarting rewinds the run clock, and the second
  // drop is not a first drop — so once the opening seconds are spent they stay
  // spent for as long as this HUD is mounted.
  const [expired, setExpired] = useState(false);
  if (!expired && time >= PRIMER_SECONDS) setExpired(true);

  // The flag is only spent once the card has actually had its time on screen,
  // so a reload that never reaches the drop cannot burn it. A returning player
  // skips the write entirely; theirs was spent runs ago.
  useEffect(() => {
    if (expired && !seenBefore) markPrimerSeen();
  }, [expired, seenBefore]);

  if (seenBefore || expired || status !== "playing") return null;

  const remaining = PRIMER_SECONDS - time;
  const opacity = remaining >= FADE_SECONDS ? 1 : Math.max(0, remaining / FADE_SECONDS);

  return (
    <div
      data-testid="first-drop-primer"
      aria-hidden
      style={{ opacity }}
      className="absolute bottom-[74px] left-3 w-[204px] rounded-[6px] border border-white/12 bg-black/55 px-3 py-2.5 transition-opacity duration-500"
    >
      <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#ffb26b]">Objective</div>
      <div className="mb-2 text-[11px] leading-tight text-white/80">{objectiveFor(state)}</div>
      <div className="flex flex-col gap-[3px] border-t border-white/10 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/50">
        {PRIMER_KEYS.map(([key, action]) => (
          <div key={key} className="flex items-baseline gap-2">
            <span className="w-[52px] shrink-0 text-right font-bold text-white/80">{key}</span>
            <span className="min-w-0 truncate">{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
