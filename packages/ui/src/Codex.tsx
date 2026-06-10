import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "./cn";
import { MainMenuAction, MainMenuNav, MainMenuScreen, MainMenuTitle, MainMenuTitleLine, MenuKicker } from "./Menu";

/**
 * One dossier in the codex. Data-agnostic by design: games map their lore
 * source (e.g. @shipshitgames/assets/lore bestiary/locations/factions) into
 * entries — this package never depends on the lore data itself.
 */
export interface CodexEntry {
  slug: string;
  name: string;
  /** Eyebrow line, e.g. "SCOURGE — TIER 2" or "LOCATION — WARDEN HOLDOUT". */
  kicker?: string;
  tagline: string;
  overview: string;
  /** Bulleted detail sections (gameplay read, visual motifs, war role…). */
  sections?: { label: string; items: string[] }[];
  /** Resolved sprite/portrait URL; rendered pixelated if present. */
  spriteUrl?: string | null;
  /** Accent color for the entry header (defaults to bone). */
  accentHex?: string;
  /** Undiscovered entries list as ??? with their body redacted. */
  locked?: boolean;
}

export interface CodexScreenProps {
  /** Render the screen. Returns null when false (mirrors PauseMenu). Defaults to true. */
  open?: boolean;
  /** Called by the Back action and Escape. */
  onClose?: () => void;
  /** The game's menu hero so the codex matches that game's main menu. */
  backgroundImage?: string;
  /** Small eyebrow above the title (e.g. the game or location name). */
  kicker?: ReactNode;
  title?: ReactNode;
  entries: CodexEntry[];
  backLabel?: ReactNode;
  backMeta?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Shared in-game codex: a full-screen dossier browser in the same visual
 * language as the main menu / settings screens. List on the left, dossier on
 * the right. Locked entries tease as "???" so discovery means something.
 */
export function CodexScreen({
  open = true,
  onClose,
  backgroundImage,
  kicker,
  title = "Codex",
  entries,
  backLabel = "Back",
  backMeta = "Close codex",
  className,
  style,
}: CodexScreenProps) {
  const firstUnlocked = useMemo(() => entries.find((e) => !e.locked)?.slug ?? entries[0]?.slug ?? null, [entries]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(firstUnlocked);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selected = entries.find((e) => e.slug === selectedSlug) ?? entries.find((e) => !e.locked) ?? entries[0];
  const unlockedCount = entries.filter((e) => !e.locked).length;

  return (
    <MainMenuScreen
      className={cn("ssg-codex-screen", className)}
      backgroundImage={backgroundImage}
      style={{ position: "fixed", inset: 0, zIndex: 90, ...style }}
      role="dialog"
      aria-modal="true"
      aria-label="Codex"
    >
      <div className="ssg-codex">
        <header className="ssg-codex-header">
          <div>
            {kicker && <MenuKicker>{kicker}</MenuKicker>}
            <MainMenuTitle>
              <MainMenuTitleLine>{title}</MainMenuTitleLine>
            </MainMenuTitle>
          </div>
          <span className="ssg-codex-count">
            {unlockedCount} / {entries.length} logged
          </span>
        </header>

        <div className="ssg-codex-body">
          <nav className="ssg-codex-list" aria-label="Codex entries">
            {entries.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                className={cn(
                  "ssg-codex-item",
                  entry.slug === selected?.slug && "ssg-codex-item--active",
                  entry.locked && "ssg-codex-item--locked",
                )}
                onClick={() => setSelectedSlug(entry.slug)}
              >
                <span className="ssg-codex-item-name">{entry.locked ? "???" : entry.name}</span>
                {entry.kicker && !entry.locked && <span className="ssg-codex-item-meta">{entry.kicker}</span>}
              </button>
            ))}
          </nav>

          {selected && (
            <article className="ssg-codex-detail" aria-live="polite">
              {selected.locked ? (
                <>
                  <h3 className="ssg-codex-name">???</h3>
                  <p className="ssg-codex-tagline">Unlogged. Survive an encounter to open this dossier.</p>
                </>
              ) : (
                <>
                  <div className="ssg-codex-detail-head">
                    <div>
                      {selected.kicker && (
                        <span className="ssg-codex-detail-kicker" style={{ color: selected.accentHex ?? "#e9e3d6" }}>
                          {selected.kicker}
                        </span>
                      )}
                      <h3 className="ssg-codex-name">{selected.name}</h3>
                      <p className="ssg-codex-tagline">{selected.tagline}</p>
                    </div>
                    {selected.spriteUrl && (
                      <img className="ssg-codex-sprite" src={selected.spriteUrl} alt={selected.name} />
                    )}
                  </div>
                  <p className="ssg-codex-overview">{selected.overview}</p>
                  {selected.sections?.map((section) => (
                    <section key={section.label} className="ssg-codex-section">
                      <h4 className="ssg-codex-section-label">{section.label}</h4>
                      <ul className="ssg-codex-section-list">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </>
              )}
            </article>
          )}
        </div>

        <MainMenuNav aria-label="Codex" className="ssg-codex-nav">
          <MainMenuAction
            type="button"
            variant="primary"
            label={backLabel}
            meta={backMeta}
            onClick={() => onClose?.()}
          />
        </MainMenuNav>
      </div>
    </MainMenuScreen>
  );
}
