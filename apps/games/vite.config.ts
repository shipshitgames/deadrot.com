import { fileURLToPath, URL } from "node:url";
import type { PluginOption, UserConfig } from "vite";
import { type GameSlug, gameDevPorts } from "../../packages/catalog/index.js";

const SHARED_DEDUPE = ["three", "react", "react-dom", "react/jsx-runtime"];

/**
 * Produces the common Vite configuration for a catalogued Deadrot game.
 *
 * Keep per-game plugins in the surface's own config; routing, aliases, and
 * dependency identity are shared so deployed and local builds behave alike.
 */
export function createDeadrotViteConfig(slug: GameSlug, plugins: PluginOption[] = []): UserConfig {
  const port = gameDevPorts[slug];
  if (port === undefined) {
    throw new Error(`Missing dev port for Deadrot game: ${slug}`);
  }

  return {
    // Static builds are mounted below the web hub's game route.
    base: "./",
    plugins,
    resolve: {
      // The engine and UI expose peer dependencies; all games must use the app's
      // single React and Three instances to avoid runtime identity mismatches.
      dedupe: SHARED_DEDUPE,
      alias: {
        "@": fileURLToPath(new URL(`./${slug}/src`, import.meta.url)),
      },
    },
    server: {
      host: true,
      port,
    },
    build: {
      target: "es2020",
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
    },
  };
}
