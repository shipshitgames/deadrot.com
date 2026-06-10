import {
  MainMenuAction,
  MainMenuCopy,
  MainMenuLayout,
  MainMenuNav,
  MainMenuScreen,
  MainMenuTitle,
  MainMenuTitleLine,
  MainMenuTopBar,
  MenuKicker,
  UpgradeCard,
} from "@shipshitgames/ui";
import { useEffect } from "react";
import { type DrydockState, SHOP_UPGRADES, type ShopId, shopCost } from "../game/drydock";

export interface DrydockScreenProps {
  open?: boolean;
  onClose?: () => void;
  backgroundImage?: string;
  state: DrydockState;
  onBuy: (id: ShopId) => void;
}

/**
 * The Drydock: starblight's permanent meta-upgrade shop. A full-screen menu
 * screen (same shell as GameSettingsScreen) listing every meta-upgrade with its
 * tier, next-tier cost, and affordability. Each card is the buy button —
 * disabled when maxed or unaffordable. Closes on Back or Escape.
 */
export function DrydockScreen({ open = true, onClose, backgroundImage, state, onBuy }: DrydockScreenProps) {
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
      className="ssg-drydock-screen"
      backgroundImage={backgroundImage}
      style={{ position: "fixed", inset: 0, zIndex: 90 }}
      role="dialog"
      aria-modal="true"
      aria-label="Drydock"
    >
      <MainMenuTopBar mark="SSG" meta={`${state.wreckage.toLocaleString()} wreckage`}>
        Permanent refit
      </MainMenuTopBar>
      <MainMenuLayout className="ssg-main-menu-layout--menu">
        <MainMenuCopy>
          <MenuKicker>Permanent Refit</MenuKicker>
          <MainMenuTitle>
            <MainMenuTitleLine>DRY</MainMenuTitleLine>
            <MainMenuTitleLine tone="hot">DOCK</MainMenuTitleLine>
          </MainMenuTitle>
          <div className="ssg-drydock-grid">
            {SHOP_UPGRADES.map((upgrade) => {
              const tier = state.tiers[upgrade.id] ?? 0;
              const maxed = tier >= upgrade.max;
              const cost = shopCost(upgrade, tier);
              const afford = state.wreckage >= cost;
              return (
                <UpgradeCard
                  key={upgrade.id}
                  icon={upgrade.icon}
                  title={upgrade.name}
                  meta={maxed ? "MAX" : `${cost} ◆`}
                  metaTone={maxed ? "level" : "new"}
                  description={`${upgrade.desc} · ${tier}/${upgrade.max}`}
                  disabled={maxed || !afford}
                  onClick={() => onBuy(upgrade.id)}
                />
              );
            })}
          </div>
          <p className="ssg-main-menu-subtitle">
            Permanent upgrades apply to every sortie. Your salvage at run's end is banked as wreckage.
          </p>
        </MainMenuCopy>
        <MainMenuNav aria-label="Drydock">
          <MainMenuAction type="button" variant="primary" label="Back" meta="Title menu" onClick={() => onClose?.()} />
        </MainMenuNav>
      </MainMenuLayout>
    </MainMenuScreen>
  );
}
