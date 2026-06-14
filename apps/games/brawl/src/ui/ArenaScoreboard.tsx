import type { ArenaFighterHud, ArenaHud } from "../game/types";

interface ArenaScoreboardProps {
  arena: ArenaHud;
  timer: number;
}

/** Smash-style top HUD: one chip per fighter with damage% + remaining stocks. */
export function ArenaScoreboard({ arena, timer }: ArenaScoreboardProps) {
  return (
    <div className="arena-hud" aria-live="polite">
      <div className="round-clock arena-clock">
        <span>ARENA · {arena.alive} LEFT</span>
        <strong>{timer}</strong>
      </div>
      <div className="arena-chips">
        {arena.fighters.map((fighter) => (
          <FighterChip key={fighter.slot} fighter={fighter} />
        ))}
      </div>
    </div>
  );
}

function FighterChip({ fighter }: { fighter: ArenaFighterHud }) {
  const status = fighter.blocking ? "Guard" : (fighter.attacking ?? fighter.faction);
  const classes = ["arena-chip"];
  if (fighter.isPlayer) classes.push("arena-chip--player");
  if (fighter.eliminated) classes.push("arena-chip--out");
  return (
    <div className={classes.join(" ")}>
      <div className="arena-chip__meta">
        <strong>{fighter.name}</strong>
        <span>{fighter.eliminated ? "OUT" : status}</span>
      </div>
      <div className="arena-chip__row">
        <span className="arena-chip__damage">{fighter.eliminated ? "—" : `${fighter.damage}%`}</span>
        <span className="arena-chip__stocks" role="img" aria-label={`${fighter.stocks} stocks remaining`}>
          {Array.from({ length: Math.max(0, fighter.stocks) }, (_, index) => (
            <i key={index} className="arena-pip" />
          ))}
        </span>
      </div>
    </div>
  );
}
