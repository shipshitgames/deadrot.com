# Deadrot Telemetry

Deadrot uses two telemetry paths:

- PostHog for balance and product analytics.
- Sentry for runtime errors, release health, replay-on-error, and source maps.

## Public Runtime Env

Set these per deployed app. Browser-prefixed values are public and safe to expose.

For Vite games and lore:

```env
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=production
VITE_DEADROT_RELEASE=deadrot@<git-sha>
VITE_SENTRY_TRACES_SAMPLE_RATE=0.05
VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0
VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE=1
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_BALANCE_TELEMETRY_SAMPLE_RATE=1
```

For the Next.js web app:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_DEADROT_RELEASE=deadrot@<git-sha>
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05
```

## Secret Build Env

Keep these only in local ignored env files, CI, or deployment secrets:

```env
SENTRY_AUTH_TOKEN=
SENTRY_ORG=shipshitgames
SENTRY_RELEASE=deadrot@<git-sha>
```

`SENTRY_AUTH_TOKEN` is for source-map upload and release management. Never put it in a `VITE_` or `NEXT_PUBLIC_` variable.

## Source Maps

Next.js source maps are handled through `@sentry/nextjs` during `apps/web` builds when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT=deadrot-web` are present.

Vite game source maps use the repo script:

```bash
bun run build
SENTRY_RELEASE=deadrot@$(git rev-parse --short=12 HEAD) bun run sentry:upload-vite-sourcemaps
```

The upload script:

1. Injects Sentry debug IDs into built game JS and maps.
2. Uploads artifacts to each `deadrot-*` Sentry project.
3. Removes generated `.map` files and `sourceMappingURL` comments from `dist` unless `--keep-sourcemaps` is passed.

Deploy the post-upload `dist` output so runtime debug IDs match the uploaded artifact bundles.
`bun run deploy:games:changed` does this automatically for each built game before calling Vercel deploy.

## Checks

Before deployment:

```bash
bun run telemetry:check-env
bun run typecheck
bun run build
```
