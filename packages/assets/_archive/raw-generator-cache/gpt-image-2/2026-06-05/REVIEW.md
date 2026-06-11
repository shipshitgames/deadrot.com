# gpt-image-2 Raw Cache Review

Status: pending human triage.

This batch preserves raw generated image originals copied from
`/Users/decod3rslabs/.codex/generated_images/`.

- Date archived: 2026-06-05
- Provider/model label: `gpt-image-2`
- Raw image count: 157
- Approximate size: 316 MB
- Original cache structure: preserved under `raw/<uuid>/`

## Review Workflow

1. Inspect every image in `raw/`.
2. Mark each useful image as `approved`, `regenerate`, or `delete` in a review
   note or manifest.
3. Move approved source/history images into semantic dated paths under
   `packages/assets/sources/generated/...`.
4. Move approved runtime outputs into the appropriate runtime package path.
5. Delete rejected images once they no longer need review context.

Do not promote raw UUID directory names or provider cache filenames into
`sources/generated`.
