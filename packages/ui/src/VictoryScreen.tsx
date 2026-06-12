import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { MenuScreen } from "./Menu";
import { PixelConfetti } from "./PixelConfetti";

export interface VictoryScreenProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  kicker?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  confetti?: boolean;
  confettiCount?: number;
  confettiSeed?: number | string;
}

/**
 * Shared all-games win screen shell: confetti, victory title treatment, and
 * stable content/action slots. Games own the stats and restart/shop buttons.
 */
export function VictoryScreen({
  kicker,
  title = "VICTORY",
  subtitle,
  children,
  actions,
  confetti = true,
  confettiCount = 96,
  confettiSeed = "victory",
  className,
  ...props
}: VictoryScreenProps) {
  return (
    <MenuScreen className={cn("ssg-victory-screen", className)} {...props}>
      {confetti && <PixelConfetti count={confettiCount} seed={confettiSeed} className="ssg-victory-screen__confetti" />}
      <div className="ssg-victory-screen__content">
        {kicker && <div className="ssg-victory-screen__kicker">{kicker}</div>}
        {title && <h1 className="ssg-victory-screen__title">{title}</h1>}
        {subtitle && <div className="ssg-victory-screen__subtitle">{subtitle}</div>}
        {children && <div className="ssg-victory-screen__body">{children}</div>}
        {actions && <div className="ssg-victory-screen__actions">{actions}</div>}
      </div>
    </MenuScreen>
  );
}
