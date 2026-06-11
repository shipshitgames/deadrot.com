# Asset Cleanup Archive - 2026-06-11

This folder holds rejected or review-only files moved out of `packages/assets`
so the runtime package can stay CDN clean. Curated source history for successful
generations now belongs in `packages/assets/sources/generated/`.

Do not serve this folder as part of `/assets` or sync it to `cdn.deadrot.com`.
After review, delete files that are marked `delete`, keep notes that are still
useful, and regenerate art marked `regenerate` through the asset pipeline.

The rejected `gh-287-fringe-remediation-2026-06-10` Grok/xAI cleanup batch was
deleted outright on 2026-06-11. Its runtime promotions were reverted to the
pre-Grok assets, and future package audits fail if shipped asset manifests
include xAI/Grok provenance.

## 2026-06-11 triage result

Promoted generated-history files were moved from this review archive into
`packages/assets/sources/generated/`:

- `og-social/2026-06-11/scourge-survivors-fps-og-source.png`
- `og-social/2026-06-11/scourge-survivors-og-source.png`
- `scourge-survivors/gibs/2026-06-07/gpt-image-2-gib-source-sheet.png`
- `scourge-survivors/icons/2026-06-11/gpt-image-2-atlas-source.png`
- `scourge-survivors/animation-sheets/2026-06-11/*-sheet.png`

No xAI/Grok outputs were promoted. Any future files left in this archive should
be treated as rejected, review-only, or pending explicit triage.
