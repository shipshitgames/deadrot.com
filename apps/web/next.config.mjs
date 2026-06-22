/** @type {import('next').NextConfig} */
// Path-based game hosting: deadrot.com/<slug>/ serves each game under one origin.
// trailingSlash:true normalizes /<slug> -> /<slug>/ consistently (no redirect loop) so the
// games' relative Vite base ("./") resolves assets under the subpath.
//
// slug -> prod deploy URL and slug -> local Vite dev port both come from the single
// source of truth in @deadrot/catalog (which also drives the e2e harness, the
// Warline lobby, and the hub content layer). Add/retire a game there, not here.
import { gameDeploys as GAME_DEPLOYS, gameDevPorts as GAME_DEV_PORTS } from "@deadrot/catalog";
import { withSentryConfig } from "@sentry/nextjs";

// In `next dev` we send /<slug>/ to the local Vite dev servers so the hub reflects
// your working tree instead of the stale prod deploy. We REDIRECT (302) rather than
// rewrite/proxy: Vite's dev server emits absolute asset paths (/@vite/client,
// /src/main.tsx) that only resolve at the game's own origin — a subpath proxy of a
// dev server 404s. Bouncing the browser to localhost:<port> lands it where those
// paths work, and matches how Warline already navigates the dev fleet by port.
// Prod stays a same-origin rewrite-proxy to the built (relative-base) deploys.
// Set DEADROT_PROXY_PROD=1 to force the prod deploys in dev (hub-only iteration with
// the game servers down).
const useLocalGames = process.env.NODE_ENV !== "production" && process.env.DEADROT_PROXY_PROD !== "1";

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  // The lore data layer (@shipshitgames/assets/lore) ships as workspace TS source.
  transpilePackages: ["@shipshitgames/assets"],
  async rewrites() {
    if (useLocalGames) return [];
    return Object.entries(GAME_DEPLOYS).flatMap(([slug, url]) => [
      { source: `/${slug}`, destination: `${url}/` },
      { source: `/${slug}/`, destination: `${url}/` },
      { source: `/${slug}/:path*`, destination: `${url}/:path*` },
    ]);
  },
  async redirects() {
    if (!useLocalGames) return [];
    return Object.keys(GAME_DEPLOYS).flatMap((slug) => {
      const url = `http://localhost:${GAME_DEV_PORTS[slug]}`;
      return [
        { source: `/${slug}`, destination: `${url}/`, permanent: false },
        { source: `/${slug}/`, destination: `${url}/`, permanent: false },
        { source: `/${slug}/:path*`, destination: `${url}/:path*`, permanent: false },
      ];
    });
  },
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG ?? "shipshitgames",
  project: process.env.SENTRY_PROJECT ?? "deadrot-web",
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
});
