import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
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

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

for (const game of PUBLIC_GAME_BUILDS) {
  await run("bun", ["run", "build"], { cwd: game.sourceRoot });

  const outputRoot = path.join(game.sourceRoot, "dist");
  const publicRoot = path.join(WEB_ROOT, "public", game.slug);

  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(path.dirname(publicRoot), { recursive: true });
  await cp(outputRoot, publicRoot, { recursive: true, dereference: true });
}
