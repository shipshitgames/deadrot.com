# @shipshitgames/ui

Deadrot's private, workspace-only UI system. The existing package name is kept
to preserve consumer imports, but this package is not an npm publishing
boundary: it depends on the private `@deadrot/catalog` roster and intentionally
contains Deadrot-specific menu copy, lobby navigation, settings, and music
runtime behavior.

All current consumers live in this monorepo and must depend on it with
`"@shipshitgames/ui": "workspace:*"`. Reusable org-level UI can be extracted
only when a concrete non-Deadrot consumer establishes that contract; do not
publish this package as-is.

The cross-game contract is CSS first:

```ts
import "@shipshitgames/ui/styles.css";
```

Use the `ssg-*` classes in every game, including vanilla TS/Three games:

- `ssg-menu-screen`
- `ssg-menu-panel`
- `ssg-menu-title`
- `ssg-menu-kicker`
- `ssg-button`
- `ssg-button--primary`
- `ssg-button--ghost`
- `ssg-button--stack`
- `ssg-button--back`
- `ssg-upgrade-card`
- `ssg-hud-corner`
- `ssg-stat-label`
- `ssg-stat-value`

React games can additionally import wrappers:

```tsx
import { Button, Card, UpgradeCard } from "@shipshitgames/ui";
```

The root export is the supported workspace API. It includes the generic-looking
primitives as well as Deadrot adapters such as `gameMenuConfig`, lobby helpers,
global game settings, and `MusicDirector`. `styles.css` is the only supported
subpath export.

## Verification

```sh
bun run --cwd packages/ui test
bun run --cwd packages/ui typecheck
bun run --cwd packages/ui build
```

## Style

The style is the locked Scourge universe bible:

- Near-black void, coal, iron, gunmetal.
- Blood red primary actions.
- Hellfire orange focus/hover/accent.
- Bone text and ash secondary text.
- Toxic green only for Scourge infection, breach cores, or parasite nodes.
- Hard edges, no soft rounded app UI.
- No cyan, magenta, purple, pastel, clean sci-fi, or shadcn default theme.

Generated UI mockups are reference art only. The shipped UI must be real DOM or React
controls using these classes.
