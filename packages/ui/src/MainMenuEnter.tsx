import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "./cn";

/**
 * Gate a title screen behind an arcade "press enter to continue" splash. The
 * title/hero stays on screen; the caller shows {@link MainMenuEnterPrompt}
 * instead of the menu nav until this returns true.
 *
 * Enter / Space / Click continues. `active` should be false whenever the title
 * screen isn't the current view (e.g. mid-run), so the listeners don't fire.
 */
export function useEnterToReveal(active = true): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!active || revealed) return;
    const reveal = () => setRevealed(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reveal();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", reveal);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", reveal);
    };
  }, [active, revealed]);

  // Reset the gate whenever the title screen leaves view, so it re-splashes next time.
  useEffect(() => {
    if (!active) setRevealed(false);
  }, [active]);

  return revealed;
}

export interface MainMenuEnterPromptProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
}

/** Blinking "Press Enter to continue" prompt shown where the menu nav will appear. */
export function MainMenuEnterPrompt({
  label = "Press Enter to continue",
  className,
  ...props
}: MainMenuEnterPromptProps) {
  return (
    <div className={cn("ssg-main-menu-enter", className)} {...props}>
      <span className="ssg-main-menu-enter__caret" aria-hidden="true">
        ▸
      </span>
      <span>{label}</span>
    </div>
  );
}
