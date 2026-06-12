---
status: historical
type: prompt-batch
supersededBy: ../Style-Bible.md
---

# 2026-06-04 Website Portrait Placeholders

> **PRE-LOCK / OFF-CANON** — this batch predates the 2026-06-04 house-style lock; its "Hi-fi stylized concept render … no pixel art" rules contradict the locked medium-chunky DETAILED PIXEL ART medium ([[Style-Bible]] §1–2, §11). There is no separate hi-fi/website track — website portraits are the locked pixel medium too. Kept for history; these placeholder plates are slated for regeneration in the pixel style. (The "rejected for drifting into pixel art" note below is inverted under the lock — pixel art is now the correct target.)

## Scope

- Fill all missing character and bestiary card placeholders on `deadrot.com`.
- Keep existing runtime sprites in place where they already exist.
- Use draft portrait plates for website cards and dossier pages, not final gameplay sprites.

## Shared Prompt Rules

- Square website portrait plate, single centered subject, generous padding.
- Medium-chunky detailed PIXEL ART in the locked [[Style-Bible]] house style, with heavy-metal album-cover grime expressed through crisp pixels, ordered dithering, and DOOM palette discipline.
- Near-black `#0a0a0a` void background, hard hellfire rim-light, blood-hot falloff, crushed shadows.
- Warm DOOM grade: blood, hellfire, rust, gunmetal, coal, and bone.
- Toxic green appears only on Scourge breach cores and parasite nodes.
- No readable text, logos, UI frames, smooth 3D render, photorealism, painted concept art, anime, cyberpunk neon, magenta/cyan, or cool blue/teal grade.

## Final Website Assets

| Slot | Asset |
| --- | --- |
| Pyre Duelist | `packages/assets/entities/pyre-duelist/pactfall.webp` |
| Pyre Cauterizer | `packages/assets/entities/pyre-cauterizer/pactfall.webp` |
| Pyre Interceptor Pilot | `packages/assets/entities/pyre-interceptor-pilot/starblight.webp` |
| Field Engineer | `packages/assets/entities/warden-field-engineer/deadlane.webp` |
| Lane Gunner | `packages/assets/entities/warden-lane-gunner/deadlane.webp` |
| Wallwright | `packages/assets/entities/warden-wallwright/deadlane.webp` |
| Warden Artillerist | `packages/assets/entities/warden-artillerist/pactfall.webp` |
| Warden Bastion | `packages/assets/entities/warden-bastion/pactfall.webp` |
| Warden Defense Pilot | `packages/assets/entities/warden-defense-pilot/starblight.webp` |
| Pyre Courier | `packages/assets/entities/pyre-courier/redline.webp` |
| Warden Courier | `packages/assets/entities/warden-courier/redline.webp` |
| Pyre Saboteur | `packages/assets/entities/pyre-saboteur/rothulk.webp` |
| The Scourge | `packages/assets/entities/scourge-overview/shared.webp` |
| Render | `packages/assets/entities/scourge-elite/deadlane.webp` |
| Graft-Breacher | `packages/assets/entities/graft-breacher/deadlane.webp` |
| Rot-Engine | `packages/assets/entities/rot-engine/deadlane.webp` |
| Scourge Fighter | `packages/assets/entities/scourge-fighter/starblight.webp` |
| Orbital Breach Carrier | `packages/assets/entities/orbital-breach-carrier/starblight.webp` |
| Trucebreaker | `packages/assets/entities/trucebreaker/pactfall.webp` |
| Scourge Host Families | `packages/assets/entities/scourge-host-families/shared.webp` |

## Notes

- Outputs were resized/padded to `768x768`, then converted to WebP with `cwebp`.
- `apps/web/lib/content/index.ts` resolves `spriteBase` entries through
  package-backed `/assets` URLs.
- One rejected Pyre Courier output drifted into pixel art on a magenta background; it was replaced before integration.
