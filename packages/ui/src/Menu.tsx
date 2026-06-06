import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "./cn";

export type DivProps = HTMLAttributes<HTMLDivElement>;

export function MenuScreen({ className, ...props }: DivProps) {
  return <div className={cn("ssg-menu-screen", className)} {...props} />;
}

export function MenuPanel({ className, ...props }: DivProps) {
  return <div className={cn("ssg-menu-panel", className)} {...props} />;
}

export function MenuStack({ className, ...props }: DivProps) {
  return <div className={cn("ssg-menu-stack", className)} {...props} />;
}

export function MenuTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("ssg-menu-title", className)} {...props} />;
}

export function MenuKicker({ className, ...props }: DivProps) {
  return <div className={cn("ssg-menu-kicker", className)} {...props} />;
}

export interface MainMenuScreenProps extends DivProps {
  backgroundImage?: string;
}

export function MainMenuScreen({
  backgroundImage,
  className,
  style,
  ...props
}: MainMenuScreenProps) {
  const screenStyle = backgroundImage
    ? ({
        "--ssg-main-menu-image": `url(${backgroundImage})`,
        ...style,
      } as CSSProperties)
    : style;

  return (
    <MenuScreen
      className={cn("ssg-main-menu-screen", className)}
      style={screenStyle}
      {...props}
    />
  );
}

export interface MainMenuTopBarProps extends DivProps {
  mark?: ReactNode;
  meta?: ReactNode;
}

export function MainMenuTopBar({
  className,
  mark,
  meta,
  children,
  ...props
}: MainMenuTopBarProps) {
  return (
    <div className={cn("ssg-main-menu-topbar", className)} {...props}>
      {mark && <span className="ssg-main-menu-topbar__mark">{mark}</span>}
      {children && <span>{children}</span>}
      {meta && <span>{meta}</span>}
    </div>
  );
}

export function MainMenuLayout({ className, ...props }: DivProps) {
  return <div className={cn("ssg-main-menu-layout", className)} {...props} />;
}

export function MainMenuCopy({ className, ...props }: DivProps) {
  return <div className={cn("ssg-main-menu-copy", className)} {...props} />;
}

export function MainMenuTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("ssg-main-menu-title", className)} {...props} />;
}

export interface MainMenuTitleLineProps
  extends HTMLAttributes<HTMLSpanElement> {
  tone?: "bone" | "hot" | "ember";
}

export function MainMenuTitleLine({
  className,
  tone = "bone",
  ...props
}: MainMenuTitleLineProps) {
  return (
    <span
      className={cn(
        "ssg-main-menu-title-line",
        `ssg-main-menu-title-line--${tone}`,
        className,
      )}
      {...props}
    />
  );
}

export function MainMenuStatus({ className, ...props }: DivProps) {
  return <div className={cn("ssg-main-menu-status", className)} {...props} />;
}

export interface MainMenuNavProps extends HTMLAttributes<HTMLElement> {
  label?: ReactNode;
}

export function MainMenuNav({
  className,
  label = "Main Menu",
  children,
  ...props
}: MainMenuNavProps) {
  return (
    <nav className={cn("ssg-main-menu-nav", className)} {...props}>
      {label && <div className="ssg-main-menu-nav__label">{label}</div>}
      {children}
    </nav>
  );
}

export interface MainMenuActionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  variant?:
    | "default"
    | "primary"
    | "shop"
    | "coop"
    | "records"
    | "settings"
    | "dev";
}

export function MainMenuAction({
  className,
  icon,
  label,
  meta,
  type = "button",
  variant = "default",
  ...props
}: MainMenuActionProps) {
  return (
    <button
      type={type}
      className={cn(
        "ssg-main-menu-action",
        `ssg-main-menu-action--${variant}`,
        className,
      )}
      {...props}
    >
      <span className="ssg-main-menu-action__label">
        {icon && <span className="ssg-main-menu-action__icon">{icon}</span>}
        <span>{label}</span>
      </span>
      {meta && <span className="ssg-main-menu-action__meta">{meta}</span>}
    </button>
  );
}

export interface MenuItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

export function MenuItem({
  className,
  icon,
  title,
  description,
  type = "button",
  ...props
}: MenuItemProps) {
  return (
    <button
      type={type}
      className={cn("ssg-menu-item", className)}
      {...props}
    >
      {icon && <span className="ssg-menu-item__icon">{icon}</span>}
      <span className="ssg-menu-item__copy">
        <b>{title}</b>
        {description && <small>{description}</small>}
      </span>
    </button>
  );
}

export interface MenuCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  imageSrc?: string;
  imageAlt?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  command?: ReactNode;
}

export function MenuCard({
  className,
  imageSrc,
  imageAlt = "",
  eyebrow,
  title,
  description,
  command,
  children,
  type = "button",
  ...props
}: MenuCardProps) {
  return (
    <button
      type={type}
      className={cn("ssg-menu-card", className)}
      {...props}
    >
      {imageSrc && (
        <span className="ssg-menu-card__media">
          <img src={imageSrc} alt={imageAlt} draggable={false} />
        </span>
      )}
      <span className="ssg-menu-card__body">
        {eyebrow && <small className="ssg-menu-card__eyebrow">{eyebrow}</small>}
        <b className="ssg-menu-card__title">{title}</b>
        {description && <span className="ssg-menu-card__desc">{description}</span>}
        {children}
      </span>
      {command && <span className="ssg-menu-card__command">{command}</span>}
    </button>
  );
}

export interface UpgradeCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
}

export function UpgradeCard({
  className,
  icon,
  title,
  meta,
  description,
  children,
  type = "button",
  ...props
}: UpgradeCardProps) {
  return (
    <button
      type={type}
      className={cn("ssg-upgrade-card", className)}
      {...props}
    >
      <span className="ssg-upgrade-card__top">
        {icon && <span className="ssg-upgrade-card__icon">{icon}</span>}
        {meta && <span className="ssg-upgrade-card__meta">{meta}</span>}
      </span>
      <b className="ssg-upgrade-card__title">{title}</b>
      {description && <span className="ssg-upgrade-card__desc">{description}</span>}
      {children}
    </button>
  );
}
