import type { CSSProperties } from "react";
import { PIXEL_ICON_URLS, type PixelIconId } from "../assets/ui/pixelIcons";

interface PixelIconProps {
  id: PixelIconId;
  label?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export type { PixelIconId };

export function PixelIcon({ id, label, size = 16, className = "", style }: PixelIconProps) {
  return (
    <img
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={`pixel-icon inline-block shrink-0 align-[-0.16em] ${className}`}
      draggable={false}
      src={PIXEL_ICON_URLS[id]}
      style={{ width: size, height: size, imageRendering: "pixelated", shapeRendering: "crispEdges", ...style }}
    />
  );
}
