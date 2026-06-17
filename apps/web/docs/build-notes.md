# Build Notes

Build notes are authored in `apps/web/lib/build-notes.ts` and rendered at
`/builds` plus `/builds/<slug>`.

Keep entries operational:

- lead with player-facing highlights;
- call out game updates, Warline/meta changes, assets/audio, and
  mobile/accessibility notes;
- include validation evidence with exact commands and results;
- use dates in `YYYY-MM-DD` format and stable slugs like
  `2026-06-17-shippability-pack`.

When adding a note, run:

```bash
bun run --cwd apps/web test:unit
bunx playwright test -c apps/web/playwright.config.ts builds.spec.ts
```
