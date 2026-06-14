import { rankArena } from "../game/arena";
import type { ArenaHud, GameMode, RoundResult } from "../game/types";

interface ResultPanelProps {
  result: RoundResult;
  mode: GameMode;
  arena: ArenaHud | null;
  onRematch: () => void;
  onRoster: () => void;
}

const REASON_LABEL: Record<RoundResult["reason"], string> = {
  ko: "KO",
  time: "Time",
  "last-standing": "Last standing",
};

/** Post-match overlay — duel KO/time copy, or the Arena final standings. */
export function ResultPanel({ result, mode, arena, onRematch, onRoster }: ResultPanelProps) {
  const arenaMode = mode === "arena" && arena !== null;
  return (
    <section className="result-panel" aria-label="Round result">
      <p className="kicker">{result.outcome === "victory" ? "Front won" : "Front lost"}</p>
      <h2>{result.winnerName}</h2>
      {arenaMode ? (
        <ArenaStandings arena={arena} reason={result.reason} />
      ) : (
        <p>
          {REASON_LABEL[result.reason]} over {result.loserName}
        </p>
      )}
      <div className="select-actions">
        <button type="button" className="primary-action" onClick={onRematch}>
          Rematch
        </button>
        <button type="button" className="ghost-action" onClick={onRoster}>
          Roster
        </button>
      </div>
    </section>
  );
}

function ArenaStandings({ arena, reason }: { arena: ArenaHud; reason: RoundResult["reason"] }) {
  const ranked = rankArena(arena.fighters);
  return (
    <>
      <p>{REASON_LABEL[reason]}</p>
      <ol className="arena-standings">
        {ranked.map((fighter, index) => (
          <li key={fighter.slot} className={fighter.isPlayer ? "is-player" : undefined}>
            <span className="arena-standings__rank">{index + 1}</span>
            <span className="arena-standings__name">{fighter.name}</span>
            <span className="arena-standings__detail">
              {fighter.eliminated ? "Eliminated" : `${fighter.stocks} stock${fighter.stocks === 1 ? "" : "s"}`}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
