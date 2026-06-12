const DEFAULT_ASSET_ORIGIN = "/assets";

const configuredAssetOrigin = process.env.NEXT_PUBLIC_DEADROT_ASSET_ORIGIN?.trim();

export const ASSET_ORIGIN =
  configuredAssetOrigin && configuredAssetOrigin.length > 0
    ? configuredAssetOrigin.replace(/\/+$/, "")
    : DEFAULT_ASSET_ORIGIN;

export function assetUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${ASSET_ORIGIN}${normalizedPath}`;
}
