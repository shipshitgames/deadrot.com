# Scourge Animation Pack

First-pass generated animation frames for Scourge Survivors enemies.

Status: generated and wired. The authored split frames remain the authoritative
`pathTemplate` identities and fallback material; the default browser runtime
loads the lossless `scourge.atlas0.webp` page using frame rectangles from
`scourge.atlas.json` and manifest metadata in `animation-pack.json`.

Regenerate the derived runtime atlas with the studio-owned CLI:

```bash
bun packages/assetgen/src/cli.ts atlas \
  --assets-dir ../deadrotcom/packages/assets/games/scourge-survivors/animations/scourge \
  --out-dir ../deadrotcom/packages/assets/games/scourge-survivors/animations/scourge \
  --name scourge
```

Frame layout:

- Non-boss frames: `128x128` lossless WebP with alpha.
- Boss frames: `128x180` lossless WebP with alpha to preserve the padded low-wide boss crop.
- Every action has `front`, `side`, and `back` view folders.
- Every view has six frames: `frame-00.webp` through `frame-05.webp`.
- Original generated sheets were moved out of the runtime package and archived
  under `packages/assets/_archive/assets-cleanup-2026-06-11/packages/assets/games/scourge-survivors/animations/scourge/`.

Readability lanes:

- `host-grunt`: blood-red melee brute, black sinew, bone sword blades, small toxic green core. Heavy grounded lurch, blade-weight drag, big shoulder sway.
- `spitter-host`: sickly chartreuse / acid yellow-green sacs and throat glow, ochre infected flesh, darker limbs. Twitchy ranged scuttle, elastic sac swelling, recoil after spit.
- `winged-host`: bruised violet / purple wing membranes, red-black body, bone tips, small toxic green organs. Lightweight hover bob, fast wing-beat arcs, diving snap.
- `breach-boss`: production comic/cel-ink breach-engine silhouette with a bone-caged toxic heart, planted anchor limbs, barrage vents, black chitin, and wet crimson tissue. Its current action slots repeat the static production pose so runtime animation cannot fall back to the obsolete humanoid boss while authored action sheets are pending.

Prompt history:

- `apps/lore/content/Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
