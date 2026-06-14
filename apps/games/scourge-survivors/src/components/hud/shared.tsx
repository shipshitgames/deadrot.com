import type { ReactNode } from "react";
import type { ScoreEntry } from "../../game/storage";
import type { HUDState } from "../../game/types";
import { PixelIcon, type PixelIconId } from "../PixelIcon";

// ----------------------------------------------------------------- shared utility class strings
export const OVERLAY = "ssg-menu-screen";
export const HUD_CORNER = "ssg-hud-corner";
export const STAT_LABEL = "ssg-stat-label";
export const STAT_VALUE = "ssg-stat-value";
export const MENU_HEADING = "ssg-section-heading";
export const STAT_SUB = "ssg-stat-sub";

export function IconText({
  icon,
  children,
  size = 16,
  className = "",
}: {
  icon: PixelIconId;
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center justify-center gap-[6px] ${className}`}>
      <PixelIcon id={icon} size={size} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function runModeLabel(mode?: HUDState["runMode"]): string {
  switch (mode) {
    case "structured":
      return "Structured";
    case "endless":
      return "Endless";
    case "coop":
      return "Co-op";
    case "sandbox":
      return "Sandbox";
    case "campaign":
      return "Campaign";
    default:
      return "Run";
  }
}

function depthLabel(depth?: number, total?: number, name?: string): string {
  if (!depth) return name || "-";
  const count = total && total > 0 ? `${depth}/${total}` : `${depth}`;
  return name ? `${count} · ${name}` : count;
}

export function Leaderboard({
  scores,
  highlight,
  onClear,
}: {
  scores: ScoreEntry[];
  highlight?: ScoreEntry | null;
  onClear?: () => void;
}) {
  const th = "text-[10px] tracking-[0.08em] uppercase opacity-50 text-right px-[6px] py-[2px] font-semibold";
  const td = "text-[14px] text-right px-[6px] py-[3px]";
  return (
    <div
      className="pointer-events-auto min-w-[320px] bg-white/[0.04] border border-white/10 rounded-[10px] px-[14px] py-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] tracking-[0.1em] uppercase opacity-85">
          <IconText icon="trophy" size={17}>
            Leaderboard
          </IconText>
        </span>
        {onClear && scores.length > 0 && (
          <button
            type="button"
            className="pointer-events-auto cursor-pointer text-[11px] text-[#aab4c2] bg-transparent border border-white/[0.18] rounded-md px-2 py-[2px]"
            onClick={onClear}
          >
            clear
          </button>
        )}
      </div>
      {scores.length === 0 ? (
        <div className="text-[13px] opacity-60 py-2">No runs yet — set the first record.</div>
      ) : (
        <table className="w-full border-collapse [font-variant-numeric:tabular-nums]">
          <thead>
            <tr>
              <th className={`${th} !text-center`}>#</th>
              <th className={`${th} !text-left`}>Run</th>
              <th className={th}>Score</th>
              <th className={th}>Kills</th>
              <th className={th}>Lvl</th>
              <th className={th}>Time</th>
              <th className={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {scores.slice(0, 8).map((s, i) => {
              const me =
                highlight &&
                s.score === highlight.score &&
                s.kills === highlight.kills &&
                s.time === highlight.time &&
                s.date === highlight.date;
              return (
                <tr
                  key={`${s.date}-${s.score}-${s.kills}-${s.time}`}
                  className={me ? "bg-[rgba(255,106,0,0.14)] outline outline-1 outline-[rgba(255,106,0,0.36)]" : ""}
                >
                  <td className={`${td} !text-center`}>{i + 1}</td>
                  <td className={`${td} !text-left`}>
                    <span className="block text-[12px] font-bold uppercase tracking-[0.04em]">
                      {runModeLabel(s.mode)}
                    </span>
                    <span className="block max-w-[150px] truncate text-[10px] opacity-55">
                      {depthLabel(s.depthReached, s.depthTotal, s.depthName)}
                    </span>
                  </td>
                  <td className={td}>{s.score.toLocaleString()}</td>
                  <td className={td}>{s.kills}</td>
                  <td className={td}>{s.level ?? "-"}</td>
                  <td className={td}>{formatTime(s.time)}</td>
                  <td className={`${td} ${s.outcome === "win" ? "text-good font-bold" : "text-[#aab4c2]"}`}>
                    {s.outcome === "win" ? "WIN" : "KO"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
