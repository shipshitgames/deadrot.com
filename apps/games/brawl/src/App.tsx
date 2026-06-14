import "@shipshitgames/ui/styles.css";
import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { Game } from "./game/Game";
import { DEFAULT_PLAYER_ID, type FighterId, fighterById } from "./game/roster";
import type { GameMode, HudState, InputAction } from "./game/types";
import { ArenaScoreboard } from "./ui/ArenaScoreboard";
import { DuelHud } from "./ui/DuelHud";
import { ResultPanel } from "./ui/ResultPanel";
import { SelectPanel } from "./ui/SelectPanel";
import { TouchControls } from "./ui/TouchControls";
import "./styles.css";

void initDeadrotBrowserTelemetry({ game: "brawl", env: import.meta.env });

const INITIAL_HUD: HudState = {
  status: "select",
  mode: "duel",
  selectedId: DEFAULT_PLAYER_ID,
  arenaSlots: 3,
  opponentId: null,
  timer: 60,
  player: null,
  opponent: null,
  arena: null,
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

  const choose = (id: FighterId) => gameRef.current?.selectFighter(id);
  const setMode = (mode: GameMode) => gameRef.current?.setMode(mode);
  const setSlots = (slots: number) => gameRef.current?.setArenaSlots(slots);
  const start = () => {
    if (hud.mode === "arena") gameRef.current?.startArena(hud.selectedId, hud.arenaSlots);
    else gameRef.current?.startFight(hud.selectedId);
  };
  const command = (action: InputAction) => gameRef.current?.command(action);
  const hold = (action: InputAction, pressed: boolean) => gameRef.current?.setVirtual(action, pressed);

  return (
    <main className="brawl-shell">
      <canvas ref={canvasRef} className="brawl-canvas" aria-label="Brawl battlefield" />

      {hud.mode === "arena" && hud.arena ? (
        <ArenaScoreboard arena={hud.arena} timer={hud.timer} />
      ) : (
        <DuelHud
          player={hud.player}
          opponent={hud.opponent}
          timer={hud.timer}
          selectedName={selected.name}
          selectedFaction={selected.faction}
          opponentName={opponent?.name ?? "Rival"}
          opponentFaction={opponent?.faction ?? "Auto"}
        />
      )}

      {hud.status === "select" && (
        <SelectPanel
          mode={hud.mode}
          selectedId={hud.selectedId}
          arenaSlots={hud.arenaSlots}
          selectedFaction={selected.faction}
          onMode={setMode}
          onSlots={setSlots}
          onChoose={choose}
          onStart={start}
        />
      )}

      {hud.status === "round-over" && hud.result && (
        <ResultPanel
          result={hud.result}
          mode={hud.mode}
          arena={hud.arena}
          onRematch={() => gameRef.current?.rematch()}
          onRoster={() => choose(hud.selectedId)}
        />
      )}

      <TouchControls onCommand={command} onHold={hold} />
    </main>
  );
}
