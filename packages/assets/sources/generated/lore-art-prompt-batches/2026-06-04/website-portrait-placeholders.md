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
| Pyre Duelist | `shipshitgames/apps/web/public/sprites/portrait-pyre-duelist.webp` |
| Pyre Cauterizer | `shipshitgames/apps/web/public/sprites/portrait-pyre-cauterizer.webp` |
| Pyre Interceptor Pilot | `shipshitgames/apps/web/public/sprites/portrait-pyre-interceptor-pilot.webp` |
| Field Engineer | `shipshitgames/apps/web/public/sprites/portrait-field-engineer.webp` |
| Lane Gunner | `shipshitgames/apps/web/public/sprites/portrait-lane-gunner.webp` |
| Wallwright | `shipshitgames/apps/web/public/sprites/portrait-wallwright.webp` |
| Warden Artillerist | `shipshitgames/apps/web/public/sprites/portrait-warden-artillerist.webp` |
| Warden Bastion | `shipshitgames/apps/web/public/sprites/portrait-warden-bastion.webp` |
| Warden Defense Pilot | `shipshitgames/apps/web/public/sprites/portrait-warden-defense-pilot.webp` |
| Pyre Courier | `shipshitgames/apps/web/public/sprites/portrait-pyre-courier.webp` |
| Warden Courier | `shipshitgames/apps/web/public/sprites/portrait-warden-courier.webp` |
| Pyre Saboteur | `shipshitgames/apps/web/public/sprites/portrait-pyre-saboteur.webp` |
| The Scourge | `shipshitgames/apps/web/public/sprites/portrait-scourge.webp` |
| Render | `shipshitgames/apps/web/public/sprites/portrait-render.webp` |
| Graft-Breacher | `shipshitgames/apps/web/public/sprites/portrait-graft-breacher.webp` |
| Rot-Engine | `shipshitgames/apps/web/public/sprites/portrait-rot-engine.webp` |
| Scourge Fighter | `shipshitgames/apps/web/public/sprites/portrait-scourge-fighter.webp` |
| Orbital Breach Carrier | `shipshitgames/apps/web/public/sprites/portrait-orbital-breach-carrier.webp` |
| Trucebreaker | `shipshitgames/apps/web/public/sprites/portrait-trucebreaker.webp` |
| Scourge Host Families | `shipshitgames/apps/web/public/sprites/portrait-scourge-host-families.webp` |

## Notes

- Outputs were resized/padded to `768x768`, then converted to WebP with `cwebp`.
- `apps/web/lib/content/index.ts` now lets `spriteBase` use explicit extensions while preserving the existing `.webp` shorthand.
- One rejected Pyre Courier output drifted into pixel art on a magenta background; it was replaced before integration.
