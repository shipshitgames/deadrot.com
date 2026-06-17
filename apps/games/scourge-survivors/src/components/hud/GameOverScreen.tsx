import { Button, GlobalGameSettingsPanel, VictoryScreen } from "@shipshitgames/ui";
import { type ReactNode, useRef, useState } from "react";
import type { ScoreEntry, ShopState } from "../../game/storage";
import type { HudState } from "../../game/types";
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

function SummaryFact({
  label,
  value,
  sub,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="scourge-run-summary-cell" data-testid={testId}>
      <div className={STAT_LABEL}>{label}</div>
      <div className="scourge-run-summary-value">{value}</div>
      {sub && <div className={STAT_SUB}>{sub}</div>}
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
  state: HudState;
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
  const prevStatusRef = useRef(status);
  if (status !== prevStatusRef.current) {
    prevStatusRef.current = status;
    if (status !== "gameover" && gameOverPanel !== "summary") setGameOverPanel("summary");
  }

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

  const summaryKicker = survivors
    ? outcome === "win"
      ? `${runModeLabel(state.runMode)} run — breach sealed`
      : `${runModeLabel(state.runMode)} run — operator signal gone`
    : outcome === "win"
      ? "Breach-boss down — run cleared"
      : "You were overrun";

  const summaryTitle = survivors ? "RUN SUMMARY" : outcome === "win" ? "VICTORY" : "GAME OVER";

  const summaryBody = (
    <div className="scourge-gameover-summary" data-testid="gameover-summary">
      {survivors && (
        <section className="scourge-run-summary-card" data-testid="run-detail-summary">
          <div className="scourge-run-summary-grid">
            <SummaryFact
              label="Mode"
              value={runModeLabel(state.runMode)}
              sub={outcome === "win" ? "sealed" : "lost"}
              testId="summary-mode"
            />
            <SummaryFact
              label="Depth"
              value={`${state.runDepth}/${state.runDepthTotal}`}
              sub={state.runDepthName}
              testId="summary-depth"
            />
            <SummaryFact
              label="Operator"
              value={
                <IconText icon={state.survivorClassIcon} size={20} className="scourge-run-summary-icon-value">
                  {state.survivorClassName}
                </IconText>
              }
              sub={state.survivorClassRole}
              testId="summary-operator"
            />
            <SummaryFact
              label="Level"
              value={state.level}
              sub={state.survivorEvolved.length ? `${state.survivorEvolved.length} evolved` : "no evolutions"}
              testId="summary-level"
            />
            <SummaryFact label="Kills" value={kills} sub={`${headshots} headshots`} testId="summary-kills" />
            <SummaryFact
              label="Gold"
              value={
                <IconText icon="gold" size={18} className="scourge-run-summary-icon-value">
                  +{lastRunGold.toLocaleString()}
                </IconText>
              }
              sub="saved to shop"
              testId="summary-gold"
            />
          </div>
          {state.survivorEvolved.length > 0 && (
            <div className="scourge-run-chip-row scourge-run-chip-row--evolutions">
              {state.survivorEvolved.map((name) => (
                <span key={name} className="scourge-run-chip scourge-run-chip--evolved">
                  {name}
                </span>
              ))}
            </div>
          )}
          {state.build.length > 0 && (
            <div className="scourge-run-chip-row">
              {state.build.slice(0, 18).map((b) => (
                <span
                  key={b.id}
                  className={`scourge-run-chip ${b.evolved ? "scourge-run-chip--evolved" : ""}`}
                  title={b.name}
                >
                  <PixelIcon id={b.icon} size={15} label={b.name} /> {b.level}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="scourge-end-metrics" data-testid="run-metrics">
        <div>
          <div className={STAT_LABEL}>Score</div>
          <div className={`${STAT_VALUE} scourge-end-metric-value`}>{score.toLocaleString()}</div>
        </div>
        <div>
          <div className={STAT_LABEL}>Kills</div>
          <div className={`${STAT_VALUE} scourge-end-metric-value`}>{kills}</div>
        </div>
        <div>
          <div className={STAT_LABEL}>Headshots</div>
          <div className={`${STAT_VALUE} scourge-end-metric-value`}>{headshots}</div>
        </div>
        <div>
          <div className={STAT_LABEL}>Time</div>
          <div className={`${STAT_VALUE} scourge-end-metric-value`}>{formatTime(time)}</div>
        </div>
      </div>
      {survivors && lastRunGold > 0 && (
        <div className="scourge-gold-callout">
          <IconText icon="gold" size={18}>
            +{lastRunGold.toLocaleString()} gold earned · spend it in the Shop
          </IconText>
        </div>
      )}
      <Leaderboard
        className="scourge-summary-leaderboard"
        scores={scores}
        highlight={currentRun}
        onClear={onClearScores}
      />
    </div>
  );

  const summaryActionButtons = (
    <>
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
    </>
  );

  if (gameOverPanel === "shop" && survivors) {
    return (
      <div className={`${OVERLAY} cursor-default`}>
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
        <SettingsRow />
      </div>
    );
  }

  if (outcome === "win") {
    return (
      <VictoryScreen
        className="cursor-default scourge-victory-screen"
        kicker={summaryKicker}
        title={summaryTitle}
        subtitle={survivors ? "Gold banked. Breach pressure falling. Spend before the next descent." : undefined}
        confettiSeed={`${score}-${kills}-${Math.round(time)}`}
        actions={
          <div className="scourge-victory-actions-stack">
            <div className="scourge-summary-actions">{summaryActionButtons}</div>
            <SettingsRow className="mt-0" />
          </div>
        }
      >
        {summaryBody}
      </VictoryScreen>
    );
  }

  return (
    <div className={`${OVERLAY} cursor-default`}>
      <div className="tracking-[0.5em] text-[13px] opacity-60 uppercase mb-[10px]">{summaryKicker}</div>
      <h1 className="m-0 mb-[6px] text-[52px] tracking-[0.04em] bg-clip-text text-transparent bg-gradient-to-r from-danger to-[#ff9a3c]">
        {summaryTitle}
      </h1>
      {summaryBody}
      <div className="scourge-summary-actions mt-4">{summaryActionButtons}</div>
      <SettingsRow />
    </div>
  );
}
