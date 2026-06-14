import type { GameSlug } from "@deadrot/catalog";
import type { HTMLAttributes, ReactNode } from "react";
import type { GameSettingsScreenProps } from "./GameSettingsScreen";
import { GameSettingsScreen } from "./GameSettingsScreen";
import { gameMenuConfig, type GameMenuConfig } from "./gameMenuConfig";
import { MainMenuCopy, MainMenuStatus, MainMenuTitle, MainMenuTitleLine, MenuKicker } from "./Menu";
import type { PauseMenuProps } from "./PauseMenu";
import { PauseMenu } from "./PauseMenu";

export interface GameMenuTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  slug?: GameSlug;
  config?: GameMenuConfig;
}

function resolveConfig(slug?: GameSlug, config?: GameMenuConfig): GameMenuConfig {
  if (config) return config;
  if (!slug) throw new Error("Game menu shell requires a slug or config.");
  return gameMenuConfig(slug);
}

export function GameMenuTitle({ slug, config, ...props }: GameMenuTitleProps) {
  const menu = resolveConfig(slug, config);
  return (
    <MainMenuTitle {...props}>
      {menu.titleLines.map((line) => (
        <MainMenuTitleLine key={`${menu.slug}-${line.text}`} tone={line.tone ?? "bone"}>
          {line.text}
        </MainMenuTitleLine>
      ))}
    </MainMenuTitle>
  );
}

export interface GameMenuCopyProps extends HTMLAttributes<HTMLDivElement> {
  slug?: GameSlug;
  config?: GameMenuConfig;
  subtitle?: ReactNode;
  status?: ReactNode;
  titleProps?: HTMLAttributes<HTMLHeadingElement>;
}

export function GameMenuCopy({ slug, config, subtitle, status, titleProps, ...props }: GameMenuCopyProps) {
  const menu = resolveConfig(slug, config);
  const statusNode =
    status ??
    (menu.titleStatus.length > 0
      ? menu.titleStatus.map((item) => <span key={`${menu.slug}-status-${item}`}>{item}</span>)
      : null);

  return (
    <MainMenuCopy {...props}>
      <MenuKicker>{menu.titleKicker}</MenuKicker>
      <GameMenuTitle config={menu} {...titleProps} />
      {(subtitle ?? menu.titleSubtitle) && <p className="ssg-main-menu-subtitle">{subtitle ?? menu.titleSubtitle}</p>}
      {statusNode && <MainMenuStatus>{statusNode}</MainMenuStatus>}
    </MainMenuCopy>
  );
}

export interface GameAudioSettingsScreenProps extends GameSettingsScreenProps {
  slug: GameSlug;
}

export function GameAudioSettingsScreen({ slug, kicker, ...props }: GameAudioSettingsScreenProps) {
  const menu = gameMenuConfig(slug);
  return <GameSettingsScreen kicker={kicker === undefined ? menu.settingsKicker : kicker} {...props} />;
}

export interface GamePauseMenuProps extends PauseMenuProps {
  slug: GameSlug;
}

export function GamePauseMenu({ slug, kicker, title = "Paused", subtitle, ...props }: GamePauseMenuProps) {
  const menu = gameMenuConfig(slug);
  return (
    <PauseMenu
      kicker={kicker === undefined ? menu.pauseKicker : kicker}
      title={title}
      subtitle={subtitle === undefined ? menu.pauseSubtitle : subtitle}
      {...props}
    />
  );
}
