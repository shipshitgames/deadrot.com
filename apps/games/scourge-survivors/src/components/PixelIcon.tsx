import type { CSSProperties } from "react";
import {
  BONUS_ICON_URLS,
  type BonusIconId,
  PIXEL_ICON_URLS,
  type PixelIconId,
} from "../assets/ui/pixelIcons";

interface SharedIconProps {
  label?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

type PixelIconProps = SharedIconProps &
  ({ id: BonusIconId; variant: "bonus" } | { id: PixelIconId; variant?: "pixel" });

export type { BonusIconId, PixelIconId };

export function PixelIcon(props: PixelIconProps) {
  const { label, size = 16, className = "", style } = props;
  const comicBonus = props.variant === "bonus";
  const src = comicBonus ? BONUS_ICON_URLS[props.id] : PIXEL_ICON_URLS[props.id];

  return (
    <img
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 align-[-0.16em] ${className}`}
      draggable={false}
      src={src}
      style={{
        width: size,
        height: size,
        imageRendering: comicBonus ? "auto" : "pixelated",
        ...style,
      }}
    />
  );
}
