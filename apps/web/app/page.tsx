import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/site/eyebrow";
import { Backdrop } from "@/components/site/atmosphere";
import { GameCard } from "@/components/game/game-card";
import { FactionCrest } from "@/components/faction/faction-crest";
import { Waitlist } from "@/components/site/waitlist";
import { accentVars, factions, games, universe, type GameStatus } from "@/lib/content";

const WATCH = "https://youtube.com/@shipshitshow";
const STATUS_RANK: Record<GameStatus, number> = {
  PLAYABLE: 0,
  "IN DEV": 1,
  CONCEPT: 2,
};

export default function Home() {
  const gallery = [...games].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          style={{ imageRendering: "pixelated" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/40" />
        <div aria-hidden className="hero-particles" />

        <div className="relative z-10 flex flex-col items-center">
          <Eyebrow>A Ship Shit Games universe</Eyebrow>
          <h1 className="mt-5 w-[min(760px,94vw)] sm:w-[min(820px,90vw)] md:w-[min(880px,82vw)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/deadrot-title-gpt-image-2.webp"
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
            them feed the same canon.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </div>
      </section>

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
        <div className="mx-auto max-w-7xl">
          <Eyebrow className="text-blood">Choose a Side</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
            The Factions
          </h2>
          <p className="mt-3 max-w-2xl text-ash">
            Bound by the Pact, divided by doctrine. Burn the source, hold the line, or listen to the dark.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {factions.map((f) => (
              <Link
                key={f.slug}
                href={`/factions/${f.slug}`}
                style={accentVars(f.accent)}
                className="group relative overflow-hidden rounded-md border border-gunmetal bg-coal p-8 transition-all duration-300 hover:border-[var(--page-accent)] hover:shadow-[0_0_40px_-16px_var(--page-accent)]"
              >
                <FactionCrest
                  accent={f.accent}
                  className="absolute -right-6 -top-6 h-40 w-40 opacity-10 transition-opacity duration-300 group-hover:opacity-20"
                />
                <div className="relative z-10">
                  <FactionCrest accent={f.accent} className="h-12 w-12" />
                  <h3 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-bone">{f.name}</h3>
                  <p className="mt-1 text-xs uppercase tracking-widest text-[var(--page-accent)]">{f.doctrine}</p>
                  <p className="mt-4 text-sm leading-relaxed text-ash">{f.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
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
            New games, new horrors, and the persistent war. Join the waitlist for launch news — no spam, just the war.
          </p>
          <div className="relative mt-9 w-full">
            <Waitlist />
          </div>
        </div>
      </section>
    </main>
  );
}
