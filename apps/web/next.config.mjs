/** @type {import('next').NextConfig} */
// Path-based game hosting: deadrot.com/<slug>/ serves each game under one origin.
// trailingSlash:true normalizes /<slug> -> /<slug>/ consistently (no redirect loop) so the
// games' relative Vite base ("./") resolves assets under the subpath.
const GAME_DEPLOYS = {
  "scourge-survivors": "https://scourge-survivors.vercel.app",
  deadlane: "https://deadlane-one.vercel.app",
  pactfall: "https://pactfall.vercel.app",
  starblight: "https://starblight.vercel.app",
  redline: "https://redline-eight-theta.vercel.app",
  rothulk: "https://rothulk.vercel.app",
  // The persistent meta-layer (EPIC #34). Vite SPA (apps/games/warline) on the shipshitdev team,
  // backed by the PartyKit server at warline.vincentshipsit.partykit.dev.
  warline: "https://warline-jet.vercel.app",
};

// Local Vite dev ports — each game's vite.config.ts server.port, mirrored in
// apps/games/warline PORTALS + packages/ui lobby.ts.
const GAME_DEV_PORTS = {
  "scourge-survivors": 5178,
  deadlane: 5174,
  pactfall: 5175,
  starblight: 5179,
  redline: 5176,
  rothulk: 5177,
  warline: 5180,
};

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

export default nextConfig;
