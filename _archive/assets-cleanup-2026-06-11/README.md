# Asset Cleanup Archive - 2026-06-11

This folder holds source-like, rejected, or review-only files moved out of
`packages/assets` so the package can stay runtime/CDN clean. Paths below mirror
the original repo paths under this archive folder.

Do not serve this folder as part of `/assets` or sync it to `cdn.deadrot.com`.
After review, delete the files that are marked `delete`, keep the notes that are
still useful, and regenerate the art marked `regenerate` through the asset
pipeline.

The rejected `gh-287-fringe-remediation-2026-06-10` Grok/xAI cleanup batch was
deleted outright on 2026-06-11. Its runtime promotions were reverted to the
pre-Grok assets, and future package audits fail if shipped asset manifests
include xAI/Grok provenance.

| Original path | Reason | Suggested final action |
| --- | --- | --- |
| `packages/assets/sources/generated/og-social/2026-06-11/scourge-survivors-fps-og-source.png` | Local generated source for a separate Scourge OG art pass. | promote later |
| `packages/assets/sources/generated/og-social/2026-06-11/scourge-survivors-og-source.png` | Superseded local generated source for Scourge OG art exploration. | delete |
| `packages/assets/sources/generated/scourge-survivors/gibs/2026-06-07/gpt-image-2-gib-source-sheet.png` | Source sheet for promoted runtime gibs; runtime slices remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/breach-boss/barrage/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/breach-boss/death/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/breach-boss/lurch/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/host-grunt/death/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/host-grunt/slash/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/host-grunt/walk/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/spitter-host/death/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/spitter-host/spit/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/spitter-host/walk/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/winged-host/attack/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/winged-host/death/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/animations/scourge/winged-host/fly/source/sheet.png` | Animation source sheet; extracted runtime frames remain in package. | promote later |
| `packages/assets/games/scourge-survivors/ui/icons/pixel/gpt-image-2-atlas-source.png` | UI icon source atlas; runtime icon outputs remain in package. | promote later |
