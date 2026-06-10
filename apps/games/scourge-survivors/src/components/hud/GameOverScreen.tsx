import { Button, GlobalGameSettingsPanel } from "@shipshitgames/ui";
import { useEffect, useState } from "react";
import type { ScoreEntry, ShopState } from "../../game/storage";
import type { HUDState } from "../../game/types";
import { PixelIcon } from "../PixelIcon";
import { Shop } from "./MainMenu";
import { formatTime, IconText, Leaderboard, OVERLAY, runModeLabel, STAT_LABEL, STAT_SUB, STAT_VALUE } from "./shared";

// Music + SFX volume sliders, sourced from the shared global settings store.
// Self-subscribing, so it needs no props beyond layout spacing.
function SettingsRow({ className = "mt-4" }: { className?: string }) {
  return (
    <div className={`pointer-events-auto flex justify-center ${className}`} onClick={(e) => e.stopPropagation()}>
      <GlobalGameSettingsPanel inline className="w-[min(360px,86vw)]" />
    </div>
  );
}

/** Run summary / shop panels shown when a run ends. */
export function GameOverScreen({
  state,
  scores,
  shop,
  lastRunGold,
  onRestart,
  onMenu,
  onBuyShop,
  onClearScores,
}: {
  state: HUDState;
  scores: ScoreEntry[];
  shop: ShopState;
  lastRunGold: number;
  onRestart: () => void;
  onMenu: () => void;
  onBuyShop: (id: string) => void;
  onClearScores: () => void;
}) {
  const { status, score, kills, headshots, time, outcome, survivors } = state;

  const [gameOverPanel, setGameOverPanel] = useState<"summary" | "shop">("summary");
  useEffect(() => {
    if (status !== "gameover") setGameOverPanel("summary");
  }, [status]);

  const currentRun: ScoreEntry | null =
    status === "gameover" && outcome
      ? {
          score,
          kills,
          headshots,
          time,
          outcome,
          mode: state.runMode,
          level: state.level,
          depthReached: state.runDepth,
          depthTotal: state.runDepthTotal,
          depthName: state.runDepthName,
          goldEarned: lastRunGold,
          date: scores.find((s) => s.score === score && s.kills === kills && s.time === time)?.date ?? 0,
        }
      : null;

  if (status !== "gameover") return null;

  return (
    <div className={`${OVERLAY} cursor-default`}>
      {gameOverPanel === "shop" && survivors ? (
        <>
          <div className="tracking-[0.35em] text-[13px] opacity-60 uppercase mb-[10px]">Permanent upgrades</div>
          <h1 className="m-0 mb-[10px] text-[44px] tracking-[0.04em] bg-clip-text text-transparent bg-gradient-to-r from-[#ffd166] to-[#ff6a00]">
            SHOP
          </h1>
          <Shop shop={shop} onBuy={onBuyShop} />
          <div className="flex gap-3 mt-4">
            <Button variant="ghost" onClick={() => setGameOverPanel("summary")} type="button">
              <IconText icon="back" size={16}>
                Run Summary
              </IconText>
            </Button>
            <Button variant="default" onClick={onRestart} type="button">
              <IconText icon="restart" size={16}>
                Play Again
              </IconText>
            </Button>
            <Button variant="ghost" onClick={onMenu} type="button">
              <IconText icon="menu" size={16}>
                Main Menu
              </IconText>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="tracking-[0.5em] text-[13px] opacity-60 uppercase mb-[10px]">
            {survivors
              ? outcome === "win"
                ? `${runModeLabel(state.runMode)} run — breach sealed`
                : `${runModeLabel(state.runMode)} run — operator signal gone`
              : outcome === "win"
                ? "Breach-boss down — run cleared"
                : "You were overrun"}
          </div>
          <h1
            className={`m-0 mb-[6px] text-[52px] tracking-[0.04em] bg-clip-text text-transparent bg-gradient-to-r ${
              outcome === "win" ? "from-good to-[#b6ff8a]" : "from-danger to-[#ff9a3c]"
            }`}
          >
            {survivors ? "RUN SUMMARY" : outcome === "win" ? "VICTORY" : "GAME OVER"}
          </h1>
          {survivors && (
            <div className="mb-[14px] w-[min(720px,92vw)] rounded-lg border border-white/10 bg-black/35 px-4 py-3">
              <div className="grid grid-cols-2 gap-3 text-left md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <div className={STAT_LABEL}>Mode</div>
                  <div className={`${STAT_VALUE} !text-[20px]`}>{runModeLabel(state.runMode)}</div>
                  <div className={STAT_SUB}>{outcome === "win" ? "sealed" : "lost"}</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Depth</div>
                  <div className={`${STAT_VALUE} !text-[20px]`}>
                    {state.runDepth}/{state.runDepthTotal}
                  </div>
                  <div className={STAT_SUB}>{state.runDepthName}</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Operator</div>
                  <div className={`${STAT_VALUE} !text-[20px]`}>
                    <IconText icon={state.survivorClassIcon} size={20}>
                      {state.survivorClassName}
                    </IconText>
                  </div>
                  <div className={STAT_SUB}>{state.survivorClassRole}</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Level</div>
                  <div className={`${STAT_VALUE} !text-[20px]`}>{state.level}</div>
                  <div className={STAT_SUB}>
                    {state.survivorEvolved.length ? `${state.survivorEvolved.length} evolved` : "no evolutions"}
                  </div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Kills</div>
                  <div className={`${STAT_VALUE} !text-[20px]`}>{kills}</div>
                  <div className={STAT_SUB}>{headshots} headshots</div>
                </div>
                <div>
                  <div className={STAT_LABEL}>Gold</div>
                  <div className={`${STAT_VALUE} !text-[20px]`}>
                    <IconText icon="gold" size={18}>
                      +{lastRunGold.toLocaleString()}
                    </IconText>
                  </div>
                  <div className={STAT_SUB}>saved to shop</div>
                </div>
              </div>
              {state.survivorEvolved.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {state.survivorEvolved.map((name) => (
                    <span
                      key={name}
                      className="rounded-md border border-[#ffd166]/45 bg-[#ffd166]/10 px-2 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[#ffd166]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {state.build.length > 0 && (
                <div className="mt-3 flex max-w-full flex-wrap justify-center gap-1.5">
                  {state.build.slice(0, 14).map((b) => (
                    <span
                      key={b.id}
                      className={`inline-flex items-center gap-[5px] rounded-md border px-2 py-1 text-[12px] ${
                        b.evolved ? "border-[#ffd166]/50 text-[#ffd166]" : "border-white/15 text-white/75"
                      }`}
                      title={b.name}
                    >
                      <PixelIcon id={b.icon} size={15} label={b.name} /> {b.level}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-9 my-[14px] mb-[26px]">
            <div>
              <div className={STAT_LABEL}>Score</div>
              <div className={`${STAT_VALUE} !text-[34px]`}>{score.toLocaleString()}</div>
            </div>
            <div>
              <div className={STAT_LABEL}>Kills</div>
              <div className={`${STAT_VALUE} !text-[34px]`}>{kills}</div>
            </div>
            <div>
              <div className={STAT_LABEL}>Headshots</div>
              <div className={`${STAT_VALUE} !text-[34px]`}>{headshots}</div>
            </div>
            <div>
              <div className={STAT_LABEL}>Time</div>
              <div className={`${STAT_VALUE} !text-[34px]`}>{formatTime(time)}</div>
            </div>
          </div>
          {survivors && lastRunGold > 0 && (
            <div className="my-[6px] mb-[10px] text-[#ffd166] text-[16px] font-bold [text-shadow:0_0_12px_rgba(255,209,102,0.6)]">
              <IconText icon="gold" size={18}>
                +{lastRunGold.toLocaleString()} gold earned · spend it in the Shop
              </IconText>
            </div>
          )}
          <Leaderboard scores={scores} highlight={currentRun} onClear={onClearScores} />
          <div className="flex gap-3 mt-4">
            <Button variant="default" onClick={onRestart} type="button">
              <IconText icon="restart" size={16}>
                Play Again
              </IconText>
            </Button>
            {survivors && (
              <Button variant="ghost" onClick={() => setGameOverPanel("shop")} type="button">
                <IconText icon="shop" size={16}>
                  Shop
                </IconText>
              </Button>
            )}
            <Button variant="ghost" onClick={onMenu} type="button">
              <IconText icon="menu" size={16}>
                Main Menu
              </IconText>
            </Button>
          </div>
        </>
      )}
      <SettingsRow />
    </div>
  );
}
