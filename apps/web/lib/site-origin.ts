const LOCAL_DEFAULT_ORIGIN = "http://localhost:3000";

function parseConfiguredOrigin(value: string, allowHttpLocalhost: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DEADROT_SITE_ORIGIN must be an absolute URL");
  }

  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  const allowedHost = !allowHttpLocalhost || localHost;
  const allowedProtocol = url.protocol === "https:" || (allowHttpLocalhost && localHost && url.protocol === "http:");
  if (
    !allowedHost ||
    !allowedProtocol ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("DEADROT_SITE_ORIGIN must be an allowed origin without credentials, path, query, or fragment");
  }

  return url.origin;
}

/**
 * Canonical public origin used in security-sensitive absolute URLs.
 *
 * Production and Vercel preview deployments must configure an explicit origin.
 * Local development gets one narrow default and may override it only with an
 * http(s) localhost origin. Request headers are deliberately not an input.
 */
export function canonicalSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const deployment = env.VERCEL_ENV;
  const isLocal =
    (env.NODE_ENV === "development" || env.NODE_ENV === "test") &&
    deployment !== "preview" &&
    deployment !== "production";
  const configured = env.DEADROT_SITE_ORIGIN?.trim();

  if (configured) return parseConfiguredOrigin(configured, isLocal);
  if (isLocal) return LOCAL_DEFAULT_ORIGIN;

  throw new Error("DEADROT_SITE_ORIGIN is required for preview and production checkout");
}
