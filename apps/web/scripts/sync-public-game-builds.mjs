import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "../..");

const PUBLIC_GAME_BUILDS = [
  {
    slug: "scourge-survivors",
    sourceRoot: path.join(REPO_ROOT, "apps/games/scourge-survivors"),
  },
];

for (const game of PUBLIC_GAME_BUILDS) {
  const outputRoot = path.join(game.sourceRoot, "dist");
  const publicRoot = path.join(WEB_ROOT, "public", game.slug);
  const entryPoint = path.join(outputRoot, "index.html");
  const [outputStat, entryStat] = await Promise.all([
    stat(outputRoot).catch(() => null),
    stat(entryPoint).catch(() => null),
  ]);

  if (!outputStat?.isDirectory() || !entryStat?.isFile()) {
    throw new Error(
      `Missing completed build output for ${game.slug} at ${outputRoot}. Run the root build so Turbo builds game dependencies before web.`,
    );
  }

  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(path.dirname(publicRoot), { recursive: true });
  await cp(outputRoot, publicRoot, { recursive: true, dereference: true });
}
