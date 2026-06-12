import { FilePath, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { glob } from "../../util/glob"
import fs from "fs"
import path from "path"

const packageAssetRoots = new Set([
  "assets-catalog.json",
  "assets-catalog.schema.json",
  "brand",
  "concepts",
  "entities",
  "games",
  "lore",
  "shared",
  "tokens",
  "universe",
])

const isPublishedPackageAsset = (fp: FilePath) => {
  const [root] = fp.split("/")
  return packageAssetRoots.has(root) || fp.startsWith("sources/generated/")
}

const findPackageAssetsRoot = () => {
  const candidates = [
    path.resolve(process.cwd(), "../../packages/assets"),
    path.resolve(process.cwd(), "packages/assets"),
  ]

  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")))
  if (!found) {
    throw new Error("Could not find packages/assets from lore build working directory")
  }

  return found
}

const copyPackageAsset = async (packageAssetsRoot: string, output: string, fp: FilePath) => {
  const src = joinSegments(packageAssetsRoot, fp) as FilePath
  const dest = joinSegments(output, "assets", fp) as FilePath

  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.copyFile(src, dest)

  return dest
}

export const PackageAssets: QuartzEmitterPlugin = () => ({
  name: "PackageAssets",
  async *emit({ argv }) {
    const packageAssetsRoot = findPackageAssetsRoot()
    const fps = (await glob("**", packageAssetsRoot, [])).filter(isPublishedPackageAsset)

    for (const fp of fps) {
      yield copyPackageAsset(packageAssetsRoot, argv.output, fp)
    }
  },
  async *partialEmit() {},
})
