import { ARENA_RULES } from "../game/arena";
import { FIGHTERS, type FighterId } from "../game/roster";
import type { GameMode } from "../game/types";

interface SelectPanelProps {
  mode: GameMode;
  selectedId: FighterId;
  arenaSlots: number;
  selectedFaction: string;
  onMode: (mode: GameMode) => void;
  onSlots: (slots: number) => void;
  onChoose: (id: FighterId) => void;
  onStart: () => void;
}

const SLOT_CHOICES = Array.from(
  { length: ARENA_RULES.maxSlots - ARENA_RULES.minSlots + 1 },
  (_, index) => ARENA_RULES.minSlots + index,
);

/** Character select with a Duel/Arena mode switch and Arena fighter-count picker. */
export function SelectPanel({
  mode,
  selectedId,
  arenaSlots,
  selectedFaction,
  onMode,
  onSlots,
  onChoose,
  onStart,
}: SelectPanelProps) {
  const arena = mode === "arena";
  return (
    <section className="select-panel" aria-label="Character select">
      <div className="select-copy">
        <p className="kicker">{arena ? "Arena Brawl" : "Warline Duel"}</p>
        <h1>Brawl</h1>
        <p>
          {arena
            ? `${selectedFaction} leads a ${arenaSlots}-fighter free-for-all. Last one standing — or most stocks when the clock runs out — wins.`
            : `${selectedFaction} selected. Rival assignment locks when the bell hits.`}
        </p>
      </div>

      <ModeToggle mode={mode} onMode={onMode} />
      {arena && <SlotSelector slots={arenaSlots} onSlots={onSlots} />}

      <div className="fighter-grid">
        {FIGHTERS.map((fighter) => (
          <button
            className={fighter.id === selectedId ? "fighter-card is-selected" : "fighter-card"}
            key={fighter.id}
            type="button"
            onClick={() => onChoose(fighter.id)}
          >
            <span
              className="fighter-card__sprite"
              style={{ backgroundImage: `url(${fighter.spriteUrl})` }}
              aria-hidden="true"
            />
            <span>{fighter.name}</span>
            <small>{fighter.faction}</small>
          </button>
        ))}
      </div>

      <div className="select-actions">
        <button type="button" className="primary-action" onClick={onStart}>
          {arena ? "Start Arena" : "Fight"}
        </button>
        <a className="ghost-action" href="/warline/">
          Warline
        </a>
      </div>
    </section>
  );
}

function ModeToggle({ mode, onMode }: { mode: GameMode; onMode: (mode: GameMode) => void }) {
  return (
    <fieldset className="mode-toggle" aria-label="Match mode">
      <button
        type="button"
        className={mode === "duel" ? "mode-tab is-active" : "mode-tab"}
        aria-pressed={mode === "duel"}
        onClick={() => onMode("duel")}
      >
        Duel
      </button>
      <button
        type="button"
        className={mode === "arena" ? "mode-tab is-active" : "mode-tab"}
        aria-pressed={mode === "arena"}
        onClick={() => onMode("arena")}
      >
        Arena
      </button>
    </fieldset>
  );
}

function SlotSelector({ slots, onSlots }: { slots: number; onSlots: (slots: number) => void }) {
  return (
    <fieldset className="slot-selector" aria-label="Fighter count">
      <span className="slot-selector__label">Fighters</span>
      {SLOT_CHOICES.map((count) => (
        <button
          key={count}
          type="button"
          className={count === slots ? "slot-tab is-active" : "slot-tab"}
          aria-pressed={count === slots}
          onClick={() => onSlots(count)}
        >
          {count}
        </button>
      ))}
    </fieldset>
  );
}
