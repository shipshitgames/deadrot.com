import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useReducer } from "react";
import { cn } from "./cn";

interface EnterRevealState {
  active: boolean;
  revealed: boolean;
}

type EnterRevealAction = { type: "reveal" } | { type: "sync-active"; active: boolean };

function enterRevealReducer(state: EnterRevealState, action: EnterRevealAction): EnterRevealState {
  switch (action.type) {
    case "reveal":
      return state.revealed ? state : { ...state, revealed: true };
    case "sync-active":
      return {
        active: action.active,
        revealed: action.active ? state.revealed : false,
      };
  }
}

/**
 * Gate a title screen behind an arcade "press enter to continue" splash. The
 * title/hero stays on screen; the caller shows {@link MainMenuEnterPrompt}
 * instead of the menu nav until this returns true.
 *
 * Enter / Space / Click continues. `active` should be false whenever the title
 * screen isn't the current view (e.g. mid-run), so the listeners don't fire.
 */
export function useEnterToReveal(active = true): boolean {
  const [state, dispatch] = useReducer(enterRevealReducer, {
    active,
    revealed: false,
  });

  useEffect(() => {
    dispatch({ type: "sync-active", active });
  }, [active]);

  useEffect(() => {
    if (!active || state.revealed) return;
    const reveal = () => dispatch({ type: "reveal" });
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
  }, [active, state.revealed]);

  return active && state.revealed;
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
