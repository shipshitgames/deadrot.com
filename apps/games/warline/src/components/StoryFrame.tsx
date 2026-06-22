import { FACTION_COLOR, STORY_FRAME, STORY_FRAME_OPERATIONS } from "@shipshitgames/warline";
import { HelpTooltip } from "./HelpTooltip";

/**
 * "Why Builds Matter" — the community-build story frame (#362).
 *
 * Renders the static STORY_FRAME briefing from @shipshitgames/warline: every
 * preview is an operation on the shared front, playtests read in as provisional
 * dispatches (no false canon promises), and Pyre/Warden/Scourge outcomes tie to
 * the weekly release cadence. Display-only — no state, no sim coupling.
 */
export function StoryFrame() {
  return (
    <section aria-label="Why Builds Matter briefing" className="border-2 border-gunmetal bg-coal p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-xs tracking-wide text-ash">Why Builds Matter</h2>
          <HelpTooltip label="Explain why builds matter" side="left">
            Warline is the shared campaign front. This briefing explains how each playable preview becomes an operation
            here — and why your runs and feedback move the line without locking canon.
          </HelpTooltip>
        </div>
        <span className="font-mono text-[0.6rem] text-hellfire">BRIEFING</span>
      </div>

      <p className="font-display text-sm leading-snug tracking-wide text-bone">{STORY_FRAME.headline}</p>
      <p className="mt-1 text-[0.7rem] leading-snug text-ash">{STORY_FRAME.thesis}</p>

      <div className="mt-3 flex flex-col gap-2">
        {STORY_FRAME.pillars.map((pillar) => (
          <div key={pillar.slug} className="border-2 border-gunmetal bg-iron px-2.5 py-1.5">
            <div className="font-display text-xs tracking-wide text-bone">{pillar.title}</div>
            <p className="mt-0.5 text-[0.65rem] leading-snug text-ash">{pillar.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-gunmetal pt-2">
        <div className="font-display text-[0.7rem] tracking-wide text-ash">The operation slate</div>
        <p className="mt-1 text-[0.65rem] leading-snug text-ash">Every build fields one operation on the front:</p>
        {/* Derived from the operation contract (GAME_OPERATIONS) — the same labels
            the Ops panel fires, so the slate can never list an operation the front
            does not actually field. */}
        <ul className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {STORY_FRAME_OPERATIONS.map(({ game, operation }) => (
            <li key={game} className="flex items-baseline justify-between gap-2">
              <span className="text-[0.65rem] text-bone">{operation}</span>
              <span className="font-mono text-[0.55rem] text-hellfire">{game}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 border-t border-gunmetal pt-2">
        <div className="flex items-center gap-1.5">
          {/* Styled sub-label, not a heading: Warline's e2e pins the rail's
              heading set, so extra <h*> nodes here would collide with it. */}
          <div className="font-display text-[0.7rem] tracking-wide text-ash">{STORY_FRAME.reports.lead}</div>
          <span className="font-mono text-[0.55rem] uppercase tracking-wide text-toxic">provisional</span>
        </div>
        <p className="mt-1 text-[0.65rem] leading-snug text-ash">{STORY_FRAME.reports.body}</p>
      </div>

      <div className="mt-3 border-t border-gunmetal pt-2">
        <div className="font-display text-[0.7rem] tracking-wide text-ash">{STORY_FRAME.cadence.lead}</div>
        <p className="mt-1 text-[0.65rem] leading-snug text-ash">{STORY_FRAME.cadence.note}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {STORY_FRAME.cadence.factions.map((line) => (
            <div key={line.faction} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-void"
                style={{ backgroundColor: FACTION_COLOR[line.faction] }}
              />
              <p className="text-[0.65rem] leading-snug text-ash">
                <span className="font-display tracking-wide text-bone">{line.label}</span> — {line.outcome}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
