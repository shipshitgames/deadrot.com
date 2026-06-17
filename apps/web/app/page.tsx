import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { FactionCardGrid } from "@/components/faction/faction-card-grid";
import { AccessStateBadge } from "@/components/game/access-badge";
import { GameCard } from "@/components/game/game-card";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { SeasonOne } from "@/components/site/season-one";
import { Waitlist } from "@/components/site/waitlist";
import { Button } from "@/components/ui/button";
import { COLLECTION_PRICE_LABEL, EARLY_BUYER_CODE, EARLY_BUYER_PRICE_LABEL } from "@/lib/access";
import { ACCESS_STATE_ORDER, ACCESS_STATE_PRESENTATION } from "@/lib/access-state";
import { assetUrl } from "@/lib/assets";
import { accentVars, gamesByStatus, universe } from "@/lib/content";
import { fetchRemoteFlags, selectVisibleGames } from "@/lib/flags";
import { createSocialMetadata } from "@/lib/social";

const WATCH = "https://youtube.com/@shipshitshow";

// Game visibility (#384): the PostHog ramp is consulted ONCE per ISR window, not
// per request. PostHog's decide call is a POST (uncacheable by Next's fetch data
// cache), so a naive `await fetchRemoteFlags()` in render would force the whole
// homepage to dynamic + a 2s-timeout POST on every visit. `unstable_cache` caches
// the *result* for 60s instead, so the page stays statically prerendered (ISR)
// and a flag flip propagates within the window. The anonymous evaluation is
// shared by all visitors (visibility is not per-user on the public lobby).
const cachedRemoteFlags = unstable_cache(() => fetchRemoteFlags(), ["home-game-visibility-flags"], {
  revalidate: 60,
  tags: ["game-visibility"],
});

// ISR: regenerate at most once per 60s so the remote flag ramp shows up without a
// redeploy, while keeping the homepage static (no per-request network on the hot path).
export const revalidate = 60;

export const metadata: Metadata = createSocialMetadata({
  title: "DEADROT",
  description: "A blood-soaked Ship Shit Games universe of browser games, canon, and one persistent war.",
  path: "/",
  openGraphTitle: "DEADROT - Ship Shit Games",
});

export default async function Home() {
  // Drop any game whose visibility flag is killed / not yet ramped. The remote map
  // is cached (above); the FLAG_OVERRIDES kill-switch is still applied fresh inside
  // selectVisibleGames, so it stays instant. Default-on, so without PostHog or an
  // override every game shows exactly as before — this never grants access (the
  // proxy gate still enforces the paywall on whatever stays visible).
  const gallery = selectVisibleGames(gamesByStatus, await cachedRemoteFlags());
  const premiseLead = universe.premise.split("\n\n")[0];

  return (
    <main>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={accentVars("hellfire")}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center"
      >
        <Backdrop />
        {/* Pixel hero banner (locked house style #62) */}
        <Image
          src={assetUrl("/universe/hero.webp")}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          style={{ imageRendering: "pixelated" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/40" />
        <div aria-hidden className="hero-particles" />

        <div className="relative z-10 flex flex-col items-center">
          <Eyebrow>A Ship Shit Games universe</Eyebrow>
          <h1 className="mt-5 w-[min(760px,94vw)] sm:w-[min(820px,90vw)] md:w-[min(880px,82vw)]">
            <Image
              src={assetUrl("/brand/title.webp")}
              alt="DEADROT"
              width={1120}
              height={450}
              className="h-auto w-full drop-shadow-[0_18px_34px_rgba(0,0,0,0.78)]"
            />
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ash">
            We lost the sky. Now we burn it back. One brutal, blood-soaked universe —{" "}
            <span className="text-bone">DOOM's gore with Blizzard's cohesion.</span> Every map, monster, and sprite
            forged live on stream.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
              {/* Front door into the persistent war: the Warline lobby (apps/games/warline),
                  from which every game is a walkable portal. Plain <a> for a full document
                  load — /warline/ is a rewrite to the SPA, not a Next route. */}
              {/* react-doctor-disable-next-line react-doctor/nextjs-no-a-element -- /warline/ rewrites to the Vite Warline app and needs a full document load. */}
              <a href="/warline/">Enter the War</a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-hellfire hover:text-hellfire"
            >
              <a href={WATCH} target="_blank" rel="noreferrer">
                Watch the show
              </a>
            </Button>
          </div>
        </div>

        <a
          href="#games"
          className="animate-bob absolute bottom-8 z-10 text-xs font-bold uppercase tracking-[0.3em] text-ash transition-colors hover:text-bone"
        >
          ▼ scroll
        </a>
      </section>

      {/* ── GAMES ────────────────────────────────────────────────────────── */}
      <section
        id="games"
        style={accentVars("blood")}
        className="relative scroll-mt-16 border-t border-gunmetal/40 px-6 py-24"
      >
        <div className="mx-auto max-w-7xl">
          <Eyebrow>The Arsenal</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
            Games in the Universe
          </h2>
          <p className="mt-3 max-w-2xl text-ash">
            Standalone games and prototypes in one war. Some are playable now, some are still design targets, and all of
            them feed the same canon. Everything playable is a preview/community build — rough, evolving, and built in
            the open, never a finished-game promise.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2" aria-label="What the game card states mean">
            {ACCESS_STATE_ORDER.map((state) => (
              <li key={state} className="flex items-center gap-2 text-sm text-ash">
                <AccessStateBadge state={state} />
                <span>{ACCESS_STATE_PRESENTATION[state].blurb}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SEASON ONE ───────────────────────────────────────────────────── */}
      <SeasonOne />

      {/* ── WARLINE ──────────────────────────────────────────────────────── */}
      <section
        id="warline"
        style={accentVars("blood")}
        className="relative scroll-mt-16 overflow-hidden border-t border-gunmetal/40 px-6 py-24"
      >
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>The Persistent War</Eyebrow>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold uppercase leading-tight tracking-tight text-bone sm:text-5xl">
            War for the Lanes
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ash">
            One shared planet front in playable prototype form. The Pyre and the Wardens hold the line under the Pact
            while the <span className="text-toxic">Scourge</span> pours from the breaches. Every game can report an{" "}
            <span className="text-hellfire">operation</span> — purge a breach, hold a lane, run the convoy — that
            credits the living war. Spend resources, fortify regions, recon dark sectors, and see whether the front
            moves.
          </p>
          <div className="mt-10">
            <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
              {/* react-doctor-disable-next-line react-doctor/nextjs-no-a-element -- /warline/ rewrites to the Vite Warline app and needs a full document load. */}
              <a href="/warline/">Enter Warline →</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── UNIVERSE ─────────────────────────────────────────────────────── */}
      <section style={accentVars("toxic")} className="relative overflow-hidden border-t border-gunmetal/40 px-6 py-24">
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>One Canon</Eyebrow>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold uppercase leading-tight tracking-tight text-bone sm:text-5xl">
            The Scourge eats worlds. We just make it pay.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ash">{premiseLead}</p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {universe.pillars.map((p) => (
              <div key={p.title} className="rounded-md border border-gunmetal bg-coal/60 p-5">
                <h3 className="font-display text-lg font-bold uppercase tracking-tight text-[var(--page-accent)]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ash">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Button
              asChild
              variant="outline"
              className="border-toxic/50 font-display uppercase tracking-widest text-toxic hover:bg-toxic/10 hover:text-toxic"
            >
              <Link href="/universe">Enter the Universe →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── FACTIONS ─────────────────────────────────────────────────────── */}
      <section id="factions" className="relative scroll-mt-16 border-t border-gunmetal/40 px-6 py-24">
        <FactionCardGrid />
      </section>

      {/* ── WAITLIST ─────────────────────────────────────────────────────── */}
      <section
        id="waitlist"
        style={accentVars("hellfire")}
        className="relative scroll-mt-16 border-t border-gunmetal/40 px-6 py-24"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start">
          <Eyebrow>Through the breach</Eyebrow>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold uppercase leading-tight tracking-tight text-bone sm:text-5xl">
            Be first through the breach
          </h2>
          <p className="mt-5 max-w-xl leading-relaxed text-ash">
            Deadrot is built in the open — preview and community builds ship rough and evolve on stream, not as a
            finished-game promise. Join the front: the season opens in waves, and the waitlist gets first access the
            moment each new build comes online. No spam, just the war.
          </p>
          <div className="relative mt-9 w-full">
            <Waitlist />
          </div>

          {/* Early-buyer / community-build framing. Honest about what backing buys:
              a seat in an evolving build, not a shipped game. (#355 AC3) */}
          <div className="mt-12 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-gunmetal bg-coal/60 p-6">
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-hellfire">
                Back the build early
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ash">
                The Deadrot Collection unlocks every gated build for a one-time {COLLECTION_PRICE_LABEL}. Early backers
                use code <span className="font-display tracking-widest text-bone">{EARLY_BUYER_CODE}</span> for{" "}
                {EARLY_BUYER_PRICE_LABEL} — you&apos;re funding an in-progress, community-built war and playing it as it
                grows, rough edges and all.
              </p>
              <div className="mt-4">
                <Button
                  asChild
                  variant="outline"
                  className="border-hellfire/50 font-display uppercase tracking-widest text-hellfire hover:bg-hellfire/10 hover:text-hellfire"
                >
                  <Link href="/unlock">Unlock the Collection →</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-gunmetal bg-coal/60 p-6">
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-toxic">Built in the open</h3>
              <p className="mt-2 text-sm leading-relaxed text-ash">
                Maps, monsters, and sprites are forged live every week. Waitlist members get the drop the moment a new
                build or game opens — and your runs feed the canon. Nothing here is a launched, finished product;
                it&apos;s a community build you help shape.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
