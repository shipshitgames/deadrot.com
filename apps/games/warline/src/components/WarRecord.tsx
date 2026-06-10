import { readWarRecord, type WarRecord as WarRecordData, type WarRecordEntry } from "@deadrot/game-kit/core";
import type { GameSlug } from "@shipshitgames/warline";
import { useSyncExternalStore } from "react";
import { HelpTooltip } from "./HelpTooltip";

// Display-only mirror of the shared "deadrot:war-record" localStorage store
// each game writes its run results into (see @deadrot/game-kit warRecord).
// Same-origin caveat: records aggregate in prod where the hub serves every
// game under /<slug>/; in dev each game runs on its own port (own origin), so
// records stay per-game. Never feeds the shared PartyKit simulation.

const GAME_ROWS: { slug: GameSlug; title: string }[] = [
  { slug: "scourge-survivors", title: "Scourge Survivors" },
  { slug: "deadlane", title: "Deadlane" },
  { slug: "pactfall", title: "Pactfall" },
  { slug: "starblight", title: "Starblight" },
  { slug: "redline", title: "Redline" },
  { slug: "rothulk", title: "Rothulk" },
];

function formatTimeMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function bestChips(entry: WarRecordEntry): string[] {
  const chips: string[] = [];
  if (entry.bestScore !== undefined) chips.push(`best score ${Math.round(entry.bestScore).toLocaleString()}`);
  if (entry.bestTimeMs !== undefined) chips.push(`best time ${formatTimeMs(entry.bestTimeMs)}`);
  if (entry.bestWave !== undefined) chips.push(`wave ${entry.bestWave}`);
  if (entry.bossKills) chips.push(`${entry.bossKills} boss ${entry.bossKills === 1 ? "kill" : "kills"}`);
  return chips;
}

// useSyncExternalStore seam: read localStorage once on mount (lazily), then
// re-read when the tab regains focus — i.e. the player returns from running an
// operation in another game. getSnapshot must return a stable reference
// between change events, so the parsed record is cached here.
let snapshot: WarRecordData | null = null;

function getSnapshot(): WarRecordData {
  snapshot ??= readWarRecord();
  return snapshot;
}

function subscribe(onStoreChange: () => void): () => void {
  const refresh = () => {
    snapshot = readWarRecord();
    onStoreChange();
  };
  window.addEventListener("focus", refresh);
  return () => window.removeEventListener("focus", refresh);
}

export function WarRecord() {
  const record = useSyncExternalStore(subscribe, getSnapshot);

  const rows = GAME_ROWS.filter((row) => record[row.slug]);

  return (
    <section className="border-2 border-gunmetal bg-coal p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-xs tracking-wide text-ash">Your War Record</h2>
          <HelpTooltip label="Explain your war record" side="left">
            Every Deadrot game banks its best results on this device. This card is your personal service record — it
            never pushes the shared front.
          </HelpTooltip>
        </div>
        <span className="font-mono text-[0.6rem] text-hellfire">LOCAL</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[0.65rem] leading-snug text-ash">
          No operations on record yet — launch any game from the Front and your bests muster here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const entry = record[row.slug];
            if (!entry) return null;
            const chips = bestChips(entry);
            return (
              <div key={row.slug} className="border-2 border-gunmetal bg-iron px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm tracking-wide text-bone">{row.title}</span>
                  <span className="font-mono text-[0.6rem] text-hellfire">
                    {entry.victories}W / {entry.plays - entry.victories}L
                  </span>
                </div>
                <div className="font-mono text-[0.6rem] text-ash">
                  {chips.length > 0 ? chips.join(" · ") : `${entry.plays} ${entry.plays === 1 ? "run" : "runs"} logged`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
