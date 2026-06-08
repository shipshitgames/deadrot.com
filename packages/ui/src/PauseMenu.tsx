import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn";
import {
  MainMenuAction,
  type MainMenuActionProps,
  MainMenuCopy,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuStatus,
  MainMenuTitle,
  MainMenuTitleLine,
  MenuKicker,
} from "./Menu";

const EMPTY_PAUSE_ACTIONS: PauseMenuAction[] = [];

export interface PauseMenuAction {
  /** Stable identity for React keys; falls back to position if omitted. */
  id?: string;
  label: ReactNode;
  meta?: ReactNode;
  variant?: MainMenuActionProps["variant"];
  onSelect?: () => void;
  disabled?: boolean;
}

export interface PauseMenuProps {
  /** When false, nothing renders. */
  open?: boolean;
  className?: string;
  style?: CSSProperties;
  backgroundImage?: string;
  /** Small label above the title. */
  kicker?: ReactNode;
  /** Big cinematic title — defaults to "Paused". */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Status row (e.g. score / wave). */
  status?: ReactNode;
  navLabel?: ReactNode;
  resumeLabel?: ReactNode;
  resumeMeta?: ReactNode;
  /** Primary "Resume" action. Omit to hide the resume button. */
  onResume?: () => void;
  /**
   * Secondary actions. Deliberately NO "shop" affordance is auto-added — the
   * pause menu mirrors the title menu (Resume / Restart / Settings / Exit).
   */
  actions?: PauseMenuAction[];
}

/**
 * Shared cinematic pause overlay built on the same MainMenu primitives as the
 * title screen, so every game's pause menu looks and behaves identically.
 */
export function PauseMenu({
  open = true,
  className,
  style,
  backgroundImage,
  kicker = "Paused",
  title = "Paused",
  subtitle,
  status,
  navLabel = "Paused",
  resumeLabel = "Resume",
  resumeMeta,
  onResume,
  actions = EMPTY_PAUSE_ACTIONS,
}: PauseMenuProps) {
  if (!open) return null;

  return (
    <MainMenuScreen
      className={cn("ssg-main-menu-screen--pause", className)}
      backgroundImage={backgroundImage}
      style={{ position: "fixed", inset: 0, zIndex: 80, ...style }}
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
    >
      <MainMenuLayout>
        <MainMenuCopy>
          {kicker && <MenuKicker>{kicker}</MenuKicker>}
          <MainMenuTitle>
            <MainMenuTitleLine tone="hot">{title}</MainMenuTitleLine>
          </MainMenuTitle>
          {subtitle && <p className="ssg-main-menu-subtitle">{subtitle}</p>}
          {status && <MainMenuStatus>{status}</MainMenuStatus>}
        </MainMenuCopy>
        <MainMenuNav label={navLabel}>
          {onResume && (
            <MainMenuAction type="button" variant="primary" label={resumeLabel} meta={resumeMeta} onClick={onResume} />
          )}
          {actions.map((action, index) => (
            <MainMenuAction
              key={action.id ?? `pause-action-${index}`}
              type="button"
              variant={action.variant ?? "default"}
              label={action.label}
              meta={action.meta}
              disabled={action.disabled}
              onClick={action.onSelect}
            />
          ))}
        </MainMenuNav>
      </MainMenuLayout>
    </MainMenuScreen>
  );
}
