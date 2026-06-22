import type { HudState } from "../game/types";

interface DuelHudProps {
  player: HudState["player"];
  opponent: HudState["opponent"];
  timer: number;
  selectedName: string;
  selectedFaction: string;
  opponentName: string;
  opponentFaction: string;
}

/** 1v1 health bars + round clock — the original Duel readout. */
export function DuelHud({
  player,
  opponent,
  timer,
  selectedName,
  selectedFaction,
  opponentName,
  opponentFaction,
}: DuelHudProps) {
  return (
    <div className="brawl-hud" aria-live="polite">
      <FighterMeter side="left" fighter={player} fallbackName={selectedName} fallbackFaction={selectedFaction} />
      <div className="round-clock">
        <span>BRAWL</span>
        <strong>{timer}</strong>
      </div>
      <FighterMeter side="right" fighter={opponent} fallbackName={opponentName} fallbackFaction={opponentFaction} />
    </div>
  );
}

interface FighterMeterProps {
  side: "left" | "right";
  fighter: HudState["player"];
  fallbackName: string;
  fallbackFaction: string;
}

function FighterMeter({ side, fighter, fallbackName, fallbackFaction }: FighterMeterProps) {
  const health = fighter ? Math.max(0, Math.min(100, (fighter.health / fighter.maxHealth) * 100)) : 100;
  return (
    <div className={`fighter-meter fighter-meter--${side}`}>
      <div className="fighter-meter__meta">
        <strong>{fighter?.name ?? fallbackName}</strong>
        <span>{fighter?.blocking ? "Guard" : (fighter?.attacking ?? fighter?.faction ?? fallbackFaction)}</span>
      </div>
      <div className="health-track">
        <i style={{ width: `${health}%` }} />
      </div>
    </div>
  );
}
