import type { GameSlug } from "@deadrot/catalog";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { GAME_JUMP_DEFAULT_LABEL, gameJumpTargets } from "./lobby";

export interface GameJumpMenuProps extends HTMLAttributes<HTMLDivElement> {
  /** The game whose menu this strip sits on — omitted from the links. */
  currentSlug?: GameSlug;
  /** Short heading shown above the links. */
  label?: ReactNode;
}

/**
 * Compact strip of direct links into the other games, for title menus.
 * Designed to sit as the last item inside MainMenuNav so it inherits the
 * nav's width, rise animation, and `[hidden]` splash gating.
 * Must stay markup-identical to gameJumpHtml in lobby.ts (the imperative twin).
 */
export function GameJumpMenu({ currentSlug, label = GAME_JUMP_DEFAULT_LABEL, className, ...props }: GameJumpMenuProps) {
  const targets = gameJumpTargets(currentSlug);
  if (targets.length === 0) return null;
  return (
    <div className={cn("ssg-game-jump", className)} {...props}>
      {label && <span className="ssg-game-jump__label">{label}</span>}
      <span className="ssg-game-jump__links">
        {targets.map((target) => (
          <a
            key={target.slug}
            className="ssg-game-jump__link"
            href={target.href}
            style={{ "--ssg-game-jump-accent": target.accent } as CSSProperties}
          >
            {target.title}
          </a>
        ))}
      </span>
    </div>
  );
}
