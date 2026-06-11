---
status: historical
type: prompt-batch
supersededBy: ../Style-Bible.md
---

# 2026-06-04 Key Art Placeholders

> **PRE-LOCK / OFF-CANON** — this batch predates the 2026-06-04 house-style lock, and its "Hi-fi stylized concept render, **not pixel art**" rule directly contradicts the locked medium (medium-chunky DETAILED PIXEL ART; see [[Style-Bible]] §1–2, §11). Kept as a historical record. The placeholder assets it produced are to be regenerated in the locked pixel style; do **not** reuse these hi-fi prompt rules.

## Scope

- Fill the missing `Zero Day` game key-art slot.
- Replace the homepage drifting sprite stand-in with a generated Scourge-universe hero plate.
- Keep this as draft placeholder art while preserving the locked Scourge Style Bible look.

## Shared Art Rules

- Medium-chunky detailed PIXEL ART in the locked [[Style-Bible]] house style; not smooth 3D, not photoreal, not painted concept art.
- Near-black void, hard hellfire rim-light, crushed shadows, warm DOOM grade.
- Blood, hellfire, rust, gunmetal, coal, and bone dominate.
- Toxic green appears only on Scourge breach cores and parasite nodes.
- No readable text, logos, watermarks, UI frames, neon magenta/cyan, or cool blue/teal grade.

## Results

| Asset | Source Output | Workspace Asset | Notes |
| --- | --- | --- | --- |
| Zero Day | `/Users/decod3rslabs/.codex/generated_images/019e8fbd-2348-77b1-ac5c-ea661293fe4b/ig_0db4cebb68d2cc0f016a20b3f3c19481919d828895a4de14ae.png` | `packages/assets/concepts/zero-day/ui/social/og.png` | First-contact orbital last stand against an infected Scourge voidship carrier. |
| Homepage hero | `/Users/decod3rslabs/.codex/generated_images/019e8fbd-2348-77b1-ac5c-ea661293fe4b/ig_0db4cebb68d2cc0f016a20b426d594819192e61dc30450d1a8.png` | `packages/assets/universe/hero.webp` | Centered breach-boss poster plate for the homepage hero background. |

## Integration

- `apps/web/lib/content/index.ts` exposes `gameImageUrl(slug)`.
- `apps/web/components/game/game-card.tsx` uses per-game key art as the card background.
- `apps/web/app/games/[slug]/page.tsx` uses per-game key art as the game-detail hero background.
- `apps/web/app/page.tsx` uses the homepage hero plate instead of the breach-boss sprite stand-in.
