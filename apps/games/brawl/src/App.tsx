import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { Game } from "./game/Game";
import { DEFAULT_PLAYER_ID, FIGHTERS, fighterById, type FighterId } from "./game/roster";
import type { HudState, InputAction } from "./game/types";
import "./styles.css";

void initDeadrotBrowserTelemetry({ game: "brawl", env: import.meta.env });

const INITIAL_HUD: HudState = {
  status: "select",
  selectedId: DEFAULT_PLAYER_ID,
  opponentId: null,
  timer: 60,
  player: null,
  opponent: null,
  result: null,
  hits: 0,
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const selected = useMemo(() => fighterById(hud.selectedId), [hud.selectedId]);
  const opponent = hud.opponentId ? fighterById(hud.opponentId) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameRef.current) return;
    const game = new Game(canvas, setHud);
    gameRef.current = game;
    if (import.meta.env.DEV) {
      const win = window as unknown as {
        __brawlGame?: Game;
        __brawlSnapshot?: () => ReturnType<Game["debugSnapshot"]>;
      };
      win.__brawlGame = game;
      win.__brawlSnapshot = () => game.debugSnapshot();
    }
    game.start();
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const choose = (id: FighterId) => {
    gameRef.current?.selectFighter(id);
  };

  const startFight = () => {
    gameRef.current?.startFight(hud.selectedId);
  };

  const command = (action: InputAction) => {
    gameRef.current?.command(action);
  };

  const hold = (action: InputAction, pressed: boolean) => {
    gameRef.current?.setVirtual(action, pressed);
  };

  return (
    <main className="brawl-shell">
      <canvas ref={canvasRef} className="brawl-canvas" aria-label="Brawl battlefield" />

      <div className="brawl-hud" aria-live="polite">
        <FighterMeter
          side="left"
          fighter={hud.player}
          fallbackName={selected.name}
          fallbackFaction={selected.faction}
        />
        <div className="round-clock">
          <span>BRAWL</span>
          <strong>{hud.timer}</strong>
        </div>
        <FighterMeter
          side="right"
          fighter={hud.opponent}
          fallbackName={opponent?.name ?? "Rival"}
          fallbackFaction={opponent?.faction ?? "Auto"}
        />
      </div>

      {hud.status === "select" && (
        <section className="select-panel" aria-label="Character select">
          <div className="select-copy">
            <p className="kicker">Warline Duel</p>
            <h1>Brawl</h1>
            <p>{selected.faction} selected. Rival assignment locks when the bell hits.</p>
          </div>

          <div className="fighter-grid">
            {FIGHTERS.map((fighter) => (
              <button
                className={fighter.id === hud.selectedId ? "fighter-card is-selected" : "fighter-card"}
                key={fighter.id}
                type="button"
                onClick={() => choose(fighter.id)}
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
            <button type="button" className="primary-action" onClick={startFight}>
              Fight
            </button>
            <a className="ghost-action" href="/warline/">
              Warline
            </a>
          </div>
        </section>
      )}

      {hud.status === "round-over" && hud.result && (
        <section className="result-panel" aria-label="Round result">
          <p className="kicker">{hud.result.outcome === "victory" ? "Front won" : "Front lost"}</p>
          <h2>{hud.result.winnerName}</h2>
          <p>
            {hud.result.reason === "ko" ? "KO" : "Time"} over {hud.result.loserName}
          </p>
          <div className="select-actions">
            <button type="button" className="primary-action" onClick={() => gameRef.current?.rematch()}>
              Rematch
            </button>
            <button type="button" className="ghost-action" onClick={() => choose(hud.selectedId)}>
              Roster
            </button>
          </div>
        </section>
      )}

      <fieldset className="touch-controls" aria-label="Fight controls">
        <div className="touch-cluster">
          <HoldButton label="Left" onHold={(pressed) => hold("left", pressed)} />
          <HoldButton label="Right" onHold={(pressed) => hold("right", pressed)} />
          <button type="button" onClick={() => command("jump")}>
            Jump
          </button>
          <HoldButton label="Guard" onHold={(pressed) => hold("guard", pressed)} />
        </div>
        <div className="touch-cluster">
          <button type="button" onClick={() => command("light")}>
            Light
          </button>
          <button type="button" onClick={() => command("heavy")}>
            Heavy
          </button>
          <button type="button" onClick={() => command("special")}>
            Special
          </button>
        </div>
      </fieldset>
    </main>
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

interface HoldButtonProps {
  label: string;
  onHold: (pressed: boolean) => void;
}

function HoldButton({ label, onHold }: HoldButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={() => onHold(true)}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
    >
      {label}
    </button>
  );
}
