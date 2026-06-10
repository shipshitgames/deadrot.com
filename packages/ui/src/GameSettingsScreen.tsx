import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "./cn";
import { GlobalGameSettingsPanel } from "./GameSettings";
import {
  MainMenuAction,
  MainMenuCopy,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuTitle,
  MainMenuTitleLine,
  MenuKicker,
} from "./Menu";
import type { GlobalEffectKey } from "./settings";

export interface GameSettingsScreenProps {
  /** Render the screen. Returns null when false (mirrors PauseMenu). Defaults to true. */
  open?: boolean;
  /** Called by the Back action and Escape. */
  onClose?: () => void;
  /** The game's menu hero, so settings matches that game's main menu. */
  backgroundImage?: string;
  /** Small eyebrow above the title for per-game flavor (e.g. "Arena Settings"). */
  kicker?: ReactNode;
  /** Title — kept uniform ("Settings") across games by default so they all match. */
  title?: ReactNode;
  /** Back action label / meta. */
  backLabel?: ReactNode;
  backMeta?: ReactNode;
  /** Passthrough to GlobalGameSettingsPanel: which per-channel sliders to show. */
  sliderKeys?: readonly GlobalEffectKey[];
  /** Extra body rendered under the audio panel. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Shared settings screen for every game: a full-screen menu screen — the same
 * kind of content as the main menu (same MainMenuScreen / MainMenuTitle / fonts /
 * spacing), not a popup modal. Wraps the self-stateful GlobalGameSettingsPanel.
 * Replaces each game's bespoke settings overlay so settings look + behave
 * identically everywhere. Closes on the Back action or Escape.
 */
export function GameSettingsScreen({
  open = true,
  onClose,
  backgroundImage,
  kicker,
  title = "Settings",
  backLabel = "Back",
  backMeta = "Title menu",
  sliderKeys,
  children,
  className,
  style,
}: GameSettingsScreenProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <MainMenuScreen
      className={cn("ssg-settings-screen", className)}
      backgroundImage={backgroundImage}
      style={{ position: "fixed", inset: 0, zIndex: 90, ...style }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <MainMenuLayout className="ssg-main-menu-layout--menu">
        <MainMenuCopy>
          {kicker && <MenuKicker>{kicker}</MenuKicker>}
          <MainMenuTitle>
            <MainMenuTitleLine>{title}</MainMenuTitleLine>
          </MainMenuTitle>
          <GlobalGameSettingsPanel inline sliderKeys={sliderKeys} />
          {children}
        </MainMenuCopy>
        <MainMenuNav aria-label="Settings">
          <MainMenuAction
            type="button"
            variant="primary"
            label={backLabel}
            meta={backMeta}
            onClick={() => onClose?.()}
          />
        </MainMenuNav>
      </MainMenuLayout>
    </MainMenuScreen>
  );
}
