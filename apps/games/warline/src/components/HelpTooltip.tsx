import type { ReactNode } from "react";
import { useId } from "react";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface HelpTooltipProps {
  label: string;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

const SIDE_CLASS: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "left-1/2 top-full mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export function HelpTooltip({ label, children, side = "top", className = "" }: HelpTooltipProps) {
  const id = useId();

  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-4 w-4 items-center justify-center border border-gunmetal bg-void font-mono text-[0.6rem] leading-none text-ash transition-colors hover:border-hellfire hover:text-bone focus:border-hellfire focus:text-bone focus:outline-none focus:ring-1 focus:ring-hellfire"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute ${SIDE_CLASS[side]} z-50 hidden w-64 max-w-[calc(100vw-2rem)] border border-hellfire bg-void/95 px-2.5 py-2 text-left font-mono text-[0.65rem] leading-snug text-ash shadow-[var(--shadow-ember)] group-hover:block group-focus-within:block`}
      >
        {children}
      </span>
    </span>
  );
}
