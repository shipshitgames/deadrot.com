import { Button, VictoryScreen } from "@shipshitgames/ui";
import { type ReactNode, useRef, useState } from "react";
import { frontContribution, OPERATION_NAME } from "../../game/data/operation";
import type { ScoreEntry, ShopState } from "../../game/storage";
import type { HudState } from "../../game/types";
import { PixelIcon } from "../PixelIcon";
import { Shop } from "./MainMenu";
import { formatTime, IconText, Leaderboard, OVERLAY, runModeLabel, STAT_LABEL, STAT_SUB, STAT_VALUE } from "./shared";

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

function RunSummaryDetails({
  state,
  outcome,
  survivors,
  kills,
  headshots,
  lastRunGold,
  frontBiomass,
  depthValue,
}: {
  state: HudState;
  outcome: HudState["outcome"];
  survivors: boolean;
  kills: number;
  headshots: number;
  lastRunGold: number;
  frontBiomass: number;
  depthValue: string;
}) {
  return (
    <section className="scourge-run-summary-card" data-testid="run-detail-summary">
      <div className="scourge-run-summary-grid">
        {survivors && (
          <SummaryFact
            label="Operation"
            value={OPERATION_NAME}
            sub={`+${frontBiomass.toLocaleString()} biomass to the front`}
            testId="summary-operation"
          />
        )}
        <SummaryFact
          label="Mode"
          value={runModeLabel(state.runMode)}
          sub={outcome === "win" ? "sealed" : "overrun"}
          testId="summary-mode"
        />
        <SummaryFact label="Depth" value={depthValue} sub={state.runDepthName} testId="summary-depth" />
        {!survivors && (
          <SummaryFact
            label="Result"
            value={outcome === "win" ? "Sealed" : "Overrun"}
            sub={state.runDepthName}
            testId="summary-result"
          />
        )}
        {survivors && (
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
        )}
        {survivors && (
          <SummaryFact
            label="Level"
            value={state.level}
            sub={state.survivorEvolved.length ? `${state.survivorEvolved.length} evolved` : "no evolutions"}
            testId="summary-level"
          />
        )}
        <SummaryFact label="Kills" value={kills} sub={`${headshots} headshots`} testId="summary-kills" />
        {survivors && (
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
        )}
      </div>
      {survivors && state.survivorEvolved.length > 0 && (
        <div className="scourge-run-chip-row scourge-run-chip-row--evolutions">
          {state.survivorEvolved.map((name) => (
            <span key={name} className="scourge-run-chip scourge-run-chip--evolved">
              {name}
            </span>
          ))}
        </div>
      )}
      {survivors && state.build.length > 0 && (
        <div className="scourge-run-chip-row">
          {state.build.slice(0, 18).map((b) => (
            <span
              key={b.id}
              className={`scourge-run-chip ${b.evolved ? "scourge-run-chip--evolved" : ""}`}
              title={b.name}
            >
              <PixelIcon id={b.icon} variant="bonus" size={15} label={b.name} /> {b.level}
            </span>
          ))}
        </div>
      )}
    </section>
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

  const [gameOverPanel, setGameOverPanel] = useState<"summary" | "shop" | "leaderboard">("summary");
  const prevStatusRef = useRef(status);
  if (status !== prevStatusRef.current) {
    prevStatusRef.current = status;
    if (gameOverPanel !== "summary") setGameOverPanel("summary");
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

  // What this run banked into the shared Warline front (#280 / #361): the same
  // biomass App.tsx reports to the cross-game war-effort pool, credited win or
  // loss. Surfaced so the summary tells the player what operation they ran and
  // what it bought the front.
  const frontBiomass = frontContribution(kills, state.level, time);

  const summaryKicker = survivors
    ? outcome === "win"
      ? `${runModeLabel(state.runMode)} run — breach sealed`
      : `${runModeLabel(state.runMode)} run — operator signal gone`
    : outcome === "win"
      ? `${runModeLabel(state.runMode)} run — run cleared`
      : `${runModeLabel(state.runMode)} run — ${state.multiplayer ? "match ended" : "operator down"}`;

  const summaryTitle = outcome === "win" && !survivors ? "VICTORY" : "RUN SUMMARY";
  const depthValue =
    state.runDepthTotal > 0 ? `${state.runDepth}/${state.runDepthTotal}` : state.runDepth.toLocaleString();

  const summaryBody = (
    <div className="scourge-gameover-summary" data-testid="gameover-summary">
      <RunSummaryDetails
        state={state}
        outcome={outcome}
        survivors={survivors}
        kills={kills}
        headshots={headshots}
        lastRunGold={lastRunGold}
        frontBiomass={frontBiomass}
        depthValue={depthValue}
      />
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
      {survivors && (
        <div className="scourge-gold-callout" data-testid="front-report">
          <span aria-hidden>⚔</span> Warline · {OPERATION_NAME} — banked +{frontBiomass.toLocaleString()} biomass to the
          front
        </div>
      )}
      {survivors && lastRunGold > 0 && (
        <div className="scourge-gold-callout">
          <IconText icon="gold" size={18}>
            +{lastRunGold.toLocaleString()} gold earned · spend it in the Shop
          </IconText>
        </div>
      )}
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
      <Button variant="ghost" onClick={() => setGameOverPanel("leaderboard")} type="button">
        <IconText icon="trophy" size={16}>
          Leaderboard
        </IconText>
      </Button>
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
      </div>
    );
  }

  if (gameOverPanel === "leaderboard") {
    return (
      <div className={`${OVERLAY} cursor-default`}>
        <div className="tracking-[0.35em] text-[13px] opacity-60 uppercase mb-[10px]">Local records</div>
        <h1 className="m-0 mb-[16px] text-[44px] tracking-[0.04em] bg-clip-text text-transparent bg-gradient-to-r from-[#ffd166] to-[#ff6a00]">
          LEADERBOARD
        </h1>
        <Leaderboard
          className="scourge-gameover-leaderboard"
          scores={scores}
          highlight={currentRun}
          onClear={onClearScores}
        />
        <div className="scourge-summary-actions mt-5">
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
    </div>
  );
}
