import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "../..");
const ASSET_ROOT = path.join(REPO_ROOT, "packages/assets");
const PUBLIC_ASSET_ROOT = path.join(WEB_ROOT, "public/assets");
const FAVICON_ROOT = path.join(ASSET_ROOT, "masters/ui/brand/favicon");
const PUBLIC_FAVICON_ROOT = path.join(WEB_ROOT, "public/favicon");

const PUBLIC_ASSET_DIRS = ["brand", "concepts", "entities", "games", "lore", "shared", "tokens", "universe"];

await rm(PUBLIC_ASSET_ROOT, { recursive: true, force: true });
await rm(PUBLIC_FAVICON_ROOT, { recursive: true, force: true });

for (const directory of PUBLIC_ASSET_DIRS) {
  await cp(path.join(ASSET_ROOT, directory), path.join(PUBLIC_ASSET_ROOT, directory), {
    recursive: true,
    dereference: true,
  });
}

await cp(FAVICON_ROOT, PUBLIC_FAVICON_ROOT, {
  recursive: true,
  dereference: true,
});
