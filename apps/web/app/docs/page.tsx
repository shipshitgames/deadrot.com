import { BookOpen, Boxes, ExternalLink, Gamepad2, GitBranch, ScrollText, Terminal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/game/game-card";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { Button } from "@/components/ui/button";
import {
  accentVars,
  bestiary,
  characters,
  factions,
  games,
  gamesByStatus,
  getCharacter,
  getCreature,
  playableGames,
  universe,
} from "@/lib/content";
import { createSocialMetadata } from "@/lib/social";
import {
  appSurfaces,
  commands,
  contents,
  getGameDocState,
  hostFamilies,
  nextDocs,
  packages,
  principles,
  scourgeFacts,
} from "./content";

export const metadata: Metadata = createSocialMetadata({
  title: "Docs",
  description:
    "Public Ship Shit Games documentation for the games, canon, Warline, shared packages, asset pipeline, and studio workflow.",
  path: "/docs",
  openGraphTitle: "DEADROT Docs",
});

export default function DocsPage() {
  return (
    <main style={accentVars("hellfire")}>
      <section id="start" className="relative overflow-hidden px-6 pt-32 pb-16 sm:pb-20">
        <Backdrop />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
          style={{ imageRendering: "pixelated" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void via-void/80 to-void/50" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>Public Docs</Eyebrow>
          <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <h1 className="text-glow max-w-4xl font-display text-5xl font-bold uppercase leading-[0.88] tracking-tight text-bone sm:text-7xl">
                Everything We Ship
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ash">
                The public map for Ship Shit Games: the browser games, Scourge canon, Warline, shared packages, asset
                generation, research, and the studio workflow behind the work.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
                  <Link href="/#games">
                    <Gamepad2 aria-hidden />
                    Games
                  </Link>
                </Button>
                <Button
                  asChild
                  size="xl"
                  variant="outline"
                  className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-hellfire hover:text-hellfire"
                >
                  <a href="https://github.com/shipshitgames" target="_blank" rel="noreferrer">
                    <GitBranch aria-hidden />
                    Source
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-gunmetal bg-coal/80 p-5 backdrop-blur">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-bone">Contents</p>
              <nav className="mt-4 grid grid-cols-2 gap-2 text-sm lg:grid-cols-1">
                {contents.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-sm border border-gunmetal/60 bg-iron/60 px-3 py-2 font-bold uppercase tracking-widest text-ash transition-colors hover:border-hellfire hover:text-bone"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-gunmetal/40 px-6 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Playable Now" value={String(playableGames.length)} />
          <Stat label="Game Records" value={String(games.length)} />
          <Stat label="Factions" value={String(factions.length)} />
          <Stat label="Roster Entries" value={String(characters.length + bestiary.length)} />
        </div>
      </section>

      <section id="apps" className="scroll-mt-24 border-t border-gunmetal/40 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Eyebrow>Studio Platform</Eyebrow>
          <div className="mt-3 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                App Surfaces
              </h2>
              <p className="mt-4 leading-relaxed text-ash">
                The repo is a studio platform, not only a marketing site. These are the public and internal surfaces
                that currently exist in the workspace.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {appSurfaces.map((surface) => {
                const Icon = surface.icon;
                const body = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Icon aria-hidden className="size-5 text-hellfire" />
                      {surface.href ? <ExternalLink aria-hidden className="size-4 text-gunmetal" /> : null}
                    </div>
                    <p className="mt-5 font-mono text-xs text-hellfire">{surface.path}</p>
                    <h3 className="mt-2 font-display text-xl font-bold uppercase tracking-tight text-bone">
                      {surface.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-ash">{surface.description}</p>
                  </>
                );

                return surface.href ? (
                  <Link
                    key={surface.path}
                    href={surface.href}
                    className="group rounded-md border border-gunmetal bg-coal p-5 transition-all hover:border-hellfire hover:shadow-[0_0_36px_-18px_var(--page-accent)]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={surface.path} className="rounded-md border border-gunmetal bg-coal p-5">
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="games"
        style={accentVars("blood")}
        className="relative scroll-mt-24 overflow-hidden border-t border-gunmetal/40 px-6 py-20 sm:py-24"
      >
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>The Arsenal</Eyebrow>
          <div className="mt-3 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                Current Game State
              </h2>
              <p className="mt-4 leading-relaxed text-ash">
                Build status comes from this site. Canon and development notes come from the lore vault, so prototypes
                can be playable while their deeper pillar design is still marked concept.
              </p>
            </div>
            <div className="grid gap-5">
              {gamesByStatus.map((game) => {
                const state = getGameDocState(game.slug);
                if (!state) return null;
                const humanRoster = game.characterSlugs.flatMap((slug) => {
                  const character = getCharacter(slug);
                  return character ? [character.name] : [];
                });
                const scourgeRoster = game.enemySlugs.flatMap((slug) => {
                  const creature = getCreature(slug);
                  return creature ? [creature.name] : [];
                });

                return (
                  <article
                    key={game.slug}
                    style={accentVars(game.accent)}
                    className="rounded-md border border-gunmetal bg-coal/85 p-5 transition-all hover:border-[var(--page-accent)] hover:shadow-[0_0_36px_-18px_var(--page-accent)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={game.status} />
                      <span className="text-[0.65rem] uppercase tracking-widest text-ash">{game.genre}</span>
                    </div>

                    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                      <div>
                        <h3 className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-bone">
                          {game.title}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-ash">{game.tagline}</p>
                        <p className="mt-4 text-sm leading-relaxed text-ash">
                          <span className="font-bold uppercase tracking-widest text-[var(--page-accent)]">State:</span>{" "}
                          {state.state}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-ash">
                          <span className="font-bold uppercase tracking-widest text-[var(--page-accent)]">Canon:</span>{" "}
                          {state.canonRole}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-ash">
                          <span className="font-bold uppercase tracking-widest text-[var(--page-accent)]">
                            Warline:
                          </span>{" "}
                          {state.warline}
                        </p>
                      </div>

                      <div className="rounded-sm border border-gunmetal bg-void/60 p-4">
                        <p className="font-display text-sm font-bold uppercase tracking-widest text-bone">First Read</p>
                        <RosterLine
                          label="Humans"
                          value={humanRoster.length ? humanRoster.join(", ") : "Pre-schism humanity"}
                        />
                        <RosterLine
                          label="Scourge"
                          value={scourgeRoster.length ? scourgeRoster.join(", ") : "First-contact horde not locked"}
                        />
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]"
                          >
                            <Link href={`/games/${game.slug}`}>
                              <BookOpen aria-hidden />
                              Page
                            </Link>
                          </Button>
                          {game.demo ? (
                            <Button asChild size="sm" className="font-display uppercase tracking-widest">
                              <a href={game.demo}>
                                <Gamepad2 aria-hidden />
                                Demo
                              </a>
                            </Button>
                          ) : null}
                          {game.repo ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]"
                            >
                              <a href={game.repo} target="_blank" rel="noreferrer">
                                <GitBranch aria-hidden />
                                Source
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {game.features.map((feature) => (
                        <div key={feature.title} className="rounded-sm border border-gunmetal/70 bg-iron/50 p-4">
                          <p className="font-display text-sm font-bold uppercase tracking-tight text-[var(--page-accent)]">
                            {feature.title}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-ash">{feature.desc}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="scroll-mt-24 border-t border-gunmetal/40 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Eyebrow>Shared Spine</Eyebrow>
          <div className="mt-3 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                Packages
              </h2>
              <p className="mt-4 leading-relaxed text-ash">
                Shared packages keep the games from drifting into duplicate systems. Public docs should grow from these
                package contracts.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {packages.map((pkg) => (
                <div key={pkg.name} className="rounded-md border border-gunmetal bg-coal p-5">
                  <div className="flex items-center gap-3">
                    <Boxes aria-hidden className="size-5 text-hellfire" />
                    <p className="font-mono text-xs text-hellfire">{pkg.path}</p>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold uppercase tracking-tight text-bone">{pkg.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ash">{pkg.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="canon"
        style={accentVars("toxic")}
        className="relative scroll-mt-24 overflow-hidden border-t border-gunmetal/40 px-6 py-20 sm:py-24"
      >
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>One Canon</Eyebrow>
          <div className="mt-3 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                Lore Primer
              </h2>
              <p className="mt-4 leading-relaxed text-ash">{universe.premise.split("\n\n")[0]}</p>
              <Button
                asChild
                variant="outline"
                className="mt-6 border-toxic/50 font-display uppercase tracking-widest text-toxic hover:bg-toxic/10 hover:text-toxic"
              >
                <a href="https://lore.deadrot.com" target="_blank" rel="noreferrer">
                  <ScrollText aria-hidden />
                  Lore Vault
                </a>
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {scourgeFacts.map((fact) => (
                <div key={fact} className="rounded-md border border-gunmetal bg-coal/80 p-5">
                  <p className="text-sm leading-relaxed text-ash">{fact}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {factions.map((faction) => (
              <Link
                key={faction.slug}
                href={`/factions/${faction.slug}`}
                style={accentVars(faction.accent)}
                className="rounded-md border border-gunmetal bg-coal/85 p-5 transition-all hover:border-[var(--page-accent)]"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--page-accent)]">
                  {faction.doctrine}
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold uppercase tracking-tight text-bone">
                  {faction.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ash">{faction.tagline}</p>
              </Link>
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-bone">Host Families</h3>
              <p className="mt-3 text-sm leading-relaxed text-ash">
                The Scourge can take many conquered forms, but every form must read as parasitic takeover. Toxic-green
                breach cores, chitin, wet tissue, tendrils, rupture seams, and overwritten host material are the
                connective tissue.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {hostFamilies.map((family) => (
                <div key={family} className="rounded-sm border border-toxic/20 bg-toxic/5 p-4">
                  <p className="font-display text-sm font-bold uppercase tracking-tight text-toxic">{family}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {principles.map((principle) => (
              <div key={principle} className="rounded-md border border-gunmetal bg-coal/80 p-5">
                <p className="text-sm leading-relaxed text-ash">{principle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 border-t border-gunmetal/40 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Eyebrow>Build Loop</Eyebrow>
          <div className="mt-3 grid min-w-0 gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                Workflow
              </h2>
              <p className="mt-4 leading-relaxed text-ash">
                The commands below are the public entry points for building, checking, generating assets, and turning
                research into rules.
              </p>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {commands.map((command) => (
                <div key={command.title} className="min-w-0 rounded-md border border-gunmetal bg-coal p-5">
                  <div className="flex items-center gap-3">
                    <Terminal aria-hidden className="size-5 text-hellfire" />
                    <h3 className="font-display text-lg font-bold uppercase tracking-tight text-bone">
                      {command.title}
                    </h3>
                  </div>
                  <pre className="mt-4 max-w-full overflow-x-auto rounded-sm border border-gunmetal bg-void p-4 text-xs leading-relaxed text-bone">
                    <code>{command.lines.join("\n")}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 rounded-md border border-gunmetal bg-iron/40 p-6">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-bone">
              Next Public Docs To Split Out
            </h3>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-ash md:grid-cols-3">
              {nextDocs.map((item) => (
                <li key={item} className="border-l border-hellfire/50 pl-4">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gunmetal bg-coal p-5">
      <p className="font-display text-4xl font-bold uppercase tracking-tight text-bone">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-ash">{label}</p>
    </div>
  );
}

function RosterLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-ash">
      <span className="font-bold uppercase tracking-widest text-bone">{label}:</span> {value}
    </p>
  );
}
