# Arena Texture Sets

Runtime WebP texture sets for Scourge Survivors arena maps.

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
