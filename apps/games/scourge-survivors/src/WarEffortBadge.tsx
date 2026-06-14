import { fetchWarEffortBonus, type WarEffortBonus } from "@deadrot/game-kit/warline";
import { type RefObject, useEffect, useState } from "react";
import type { Game } from "./game/Game";

/**
 * Shared cross-game War-Effort buff (#280), Scourge reference UI.
 *
 * On mount it reads the pooled buff from the Warline front once
 * (`fetchWarEffortBonus`) and applies the derived damage multiplier to the live
 * game; once the shared pool has reached at least one tier it renders a small
 * badge so the player sees the collective bonus. Offline-graceful: a
 * disabled/unreachable/slow front resolves to the neutral 1x bonus, so the run
 * is simply unbuffed (never blocked or delayed) and nothing renders.
 */
export function WarEffortBadge({ gameRef }: { gameRef: RefObject<Game | null> }) {
  const [bonus, setBonus] = useState<WarEffortBonus | null>(null);

  useEffect(() => {
    let live = true;
    void fetchWarEffortBonus().then((value) => {
      if (!live) return;
      gameRef.current?.setWarEffortDamageMul(value.damageMult);
      setBonus(value);
    });
    return () => {
      live = false;
    };
  }, [gameRef]);

  if (!bonus || bonus.tier <= 0) return null;
  return (
    <div
      data-testid="war-effort-badge"
      className="pointer-events-none fixed top-2 right-2 z-50 rounded bg-black/60 px-2 py-1 font-mono text-xs text-emerald-300 ring-1 ring-emerald-400/40"
      title="Shared Warline war effort — the war resources every game banks into the front boost everyone's damage."
    >
      ⚔ War Effort T{bonus.tier} · +{Math.round((bonus.damageMult - 1) * 100)}% dmg
    </div>
  );
}
