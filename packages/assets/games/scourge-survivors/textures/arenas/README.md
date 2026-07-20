# Arena Texture Sets

Runtime WebP texture sets for Scourge Survivors arena maps.

## 2026-07-16 Comic-Ink Surface Pass

The four runtime surface roles (`floor`, `wall`, `block`, and `column`) were
re-authored as deterministic, mathematically seamless 512x512 textures. The
pass keeps the existing UV repeats, collision footprint, decals, transparent
prop plates, sky treatment, fog, and non-colliding dressing unchanged.

The preserved source recipe lives at
`packages/assets/sources/generated/2026-07-16/scourge-survivors/arena-surfaces/generate-arena-textures.ts`.
It uses posterized periodic value noise, hard contour bands, rivets, cracks,
hatching, and map-specific sourced-glow marks whose periods divide the 512px
canvas. Regenerate from the repository root with:

```sh
bun packages/assets/sources/generated/2026-07-16/scourge-survivors/arena-surfaces/generate-arena-textures.ts "$PWD"
```

The recipe emits temporary PPM masters and encodes lossless WebP with
`cwebp -lossless -exact -z 9 -m 6`. Every surface was reviewed in a 2x2 tiled
preview, and the unit suite measures wrap-edge deltas against ordinary interior
pixel transitions.

Map identity:

- Ashgate: bold foundry plates, rivets, hazard bars, and hellfire seams.
- Hollow Lanes: dead road slabs, Warden-grey buttresses, and bone-pale wear.
- Maw: black-green chitin panels and Scourge-only toxic organ fissures.
- Perdition: blood-black flesh-metal ribs and hot breach wounds.

The previous `decal.webp` and `prop.webp` assets remain in service so this pass
changes material readability without changing gameplay geometry or dressing.

## 2026-06-06 Authored Breach-Arena Pass

Generated locally with deterministic Node PPM/PAM generators and encoded to
lossless WebP with `cwebp -lossless -z 6`.

Outputs:

- `ashgate/{floor,wall,block,column,decal,prop}.webp`
- `hollowlanes/{floor,wall,block,column,decal,prop}.webp`
- `maw/{floor,wall,block,column,decal,prop}.webp`
- `perdition/{floor,wall,block,column,decal,prop}.webp`

Role pattern notes:

- `floor`: plate grids, cracks, chipped grime.
- `wall`: panel seams, rivets, vertical grime.
- `block`: beveled cover blocks and scar scratches.
- `column`: vertical ribs and cross-bands.
- `decal`: breach/scar/sigil plate blended into the floor.
- `prop`: transparent vertical sprite plate for non-colliding arena dressing.

Map palette notes:

- Ashgate: scorched foundry metal, rust, hellfire residue.
- Hollow Lanes: dead asphalt, bone dust, Warden-grey road slabs.
- Maw: dark basalt, host-bone green source staining.
- Perdition: blood-black flesh-metal and deep breach scarring.
