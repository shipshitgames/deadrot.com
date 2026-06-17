# Feature flags & dark-shipping (#384)

A thin, **vendor-agnostic** feature-flag layer (`lib/flags.ts`) backed by PostHog.
It exists so we can **dark-ship** — merge unfinished or large work to `master`
turned **off**, QA it in prod, then ramp `0% → 100%` with no redeploy — and so we
can gate a game's **visibility / release** independently of the paywall.

PostHog is already a project dependency with `NEXT_PUBLIC_POSTHOG_*` env wired;
this is a wiring layer, not a new vendor.

## Hard boundary: flags vs paywall

A feature flag is a **UX toggle**. The paywall is a **server-side security
boundary** against the billing source of truth (Stripe). They are kept in
separate systems and must never be merged:

| Question                                    | System                                     |
| ------------------------------------------- | ------------------------------------------ |
| Is the game shipped / visible / ramping?    | **PostHog flag** (`lib/flags.ts`)          |
| Is the game free or paid?                   | `lib/access.ts` static list                |
| Did **this user** pay for the paid game?    | **Clerk + Stripe** (`deadrotCollection`)   |

A flag **never grants access** — it only hides or reveals. A game shows iff
`isGameVisible(slug)` **AND** the paywall passes (the game is free **OR** the
Clerk entitlement is present). Killing a game's flag hides it from everyone,
owners included; it does **not** unlock a paid game for anyone.

## How it works

```
lib/flags.ts ──┬─ isEnabledSync(flag) / isGameVisibleSync(slug)   (edge, no network)
               │     └─ proxy.ts gate: kill-switch backstop on /<slug>/ routes
               ├─ isEnabled(flag, user) / isGameVisible(slug)      (async, PostHog)
               ├─ fetchRemoteFlags(user)  → raw remote map         (cache-friendly)
               ├─ selectVisibleGames(games, remoteMap)             (pure, network-free)
               └─ filterVisibleGames(games, user)                  (= fetch + select)
```

The flag layer is **server-side only** — there is no `posthog-js` client init.
The remote read is PostHog's stateless `/flags` decide endpoint over `fetch`, so
it runs on the edge (proxy, sync path only) and node (gallery) without an SDK.

The lobby gallery (`app/page.tsx`, a node Server Component) splits the work so
the homepage stays **statically prerendered (ISR)**: PostHog's decide call is a
**POST**, which Next's `fetch` data-cache cannot cache, so a raw
`await filterVisibleGames()` in render would force the page fully dynamic and add
a 2s-timeout POST to every visit. Instead the page wraps `fetchRemoteFlags()` in
`unstable_cache({ revalidate: 60 })` (caching the *result*, not the POST) and
resolves with the pure `selectVisibleGames`. A flag flip propagates within ~60s;
the `FLAG_OVERRIDES` kill-switch is read fresh inside `selectVisibleGames`, so it
stays instant even against a stale cached map.

Resolution precedence (highest → lowest):

1. **Explicit override** — `FLAG_OVERRIDES` env, a JSON map of `flag → bool`.
   The kill-switch, and how tests pin a value. Malformed JSON or non-boolean
   values are ignored.
2. **Remote value** — PostHog evaluation via the stateless `/flags` endpoint
   (`fetch`, no SDK, so it is safe on the edge and node runtimes). Bounded by a
   2s timeout and fail-open, so flag eval can never wedge a request.
3. **Registry default** — `flagDefault(flag)`. Unknown **game-visibility** flags
   default **ON** (a new game stays visible until explicitly killed); every other
   unknown flag defaults **OFF** — dark by default, the safe stance for
   dark-shipping.

`proxy.ts` (edge middleware, hot path) uses only the **synchronous** override +
default path — never a network call. The lobby gallery (a node Server Component)
consults the live PostHog ramp through `filterVisibleGames`.

## Naming convention

- **Game visibility:** `game-<slug>-visible` — e.g. `game-rothulk-visible`. Use
  `gameVisibilityFlag(slug)`; never hand-format the key.
- **Everything else:** kebab-case `<area>-<change>` — e.g. `web-new-hero`,
  `scourge-elite-affixes`. Add the flag to `FLAG_DEFAULTS` in `lib/flags.ts` the
  moment a call site references it, so its default is reviewable in one place.

Call sites import **only** from `lib/flags.ts` — never `posthog-js` or the
PostHog API directly — so the vendor can be swapped without touching feature code.

## Kill-switch / instant rollback

```bash
# Hide a broken game everywhere (no revert, no redeploy of code):
FLAG_OVERRIDES='{"game-rothulk-visible":false}'
```

Set it in the deploy env (or flip the flag to 0% in PostHog) and the gallery
drops the card and the proxy turns away direct `/{slug}/` visits.

## Cleanup habit — delete the flag after full rollout

**Dead flags rot fast.** A flag is temporary scaffolding, not config. Once a
change is ramped to 100% and proven:

1. Delete the flag from PostHog (and any `FLAG_OVERRIDES` / `FLAG_DEFAULTS` entry).
2. Remove the `isEnabled(...)` branch at every call site, keeping the **on** path.
3. Drop the now-dead **off** path and its tests.

A flag that has been at 100% for more than a couple of weeks is a cleanup PR
waiting to happen. Track removals as follow-up issues so they do not linger.
