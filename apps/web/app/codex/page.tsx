import { CODEX_ACCENT_HEX } from "@deadrot/game-kit/codex";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FactionCrest } from "@/components/faction/faction-crest";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { type PublicCodexEntry, publicCodexSections } from "@/lib/codex";
import { accentVars } from "@/lib/content";
import { createSocialMetadata } from "@/lib/social";

export const metadata: Metadata = createSocialMetadata({
  title: "Deadrot Codex",
  description: "The public Deadrot Codex: games, factions, characters, bestiary, locations, and timeline.",
  path: "/codex",
  openGraphTitle: "Deadrot Codex",
});

const totalEntries = publicCodexSections.reduce((total, section) => total + section.entries.length, 0);

export default function CodexPage() {
  return (
    <main style={accentVars("hellfire")}>
      <section className="relative overflow-hidden px-6 pt-32 pb-16">
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>Public Canon</Eyebrow>
          <h1 className="text-glow mt-5 font-display text-5xl font-bold uppercase tracking-tight text-bone sm:text-7xl">
            Deadrot Codex
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ash">
            A native, data-backed index of the Deadrot universe generated from the lore vault derivative, the game
            roster, and the shared asset package.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-md border border-gunmetal bg-coal px-4 py-2 font-display text-sm uppercase tracking-widest text-bone">
              {totalEntries} entries
            </span>
            {publicCodexSections.map((section) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="rounded-md border border-gunmetal bg-iron px-4 py-2 font-display text-sm uppercase tracking-widest text-ash transition-colors hover:border-hellfire hover:text-hellfire"
              >
                {section.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {publicCodexSections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="relative scroll-mt-24 border-t border-gunmetal/40 px-6 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <Eyebrow>{section.label}</Eyebrow>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                  {section.title}
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-ash">{section.summary}</p>
              </div>
              <span className="font-display text-sm uppercase tracking-widest text-gunmetal">
                {section.entries.length} entries
              </span>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.entries.map((entry) => (
                <CodexCard key={`${entry.kind}:${entry.slug}`} entry={entry} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}

function CodexCard({ entry }: { entry: PublicCodexEntry }) {
  const isSamePage = entry.href.startsWith("/codex#");
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-4">
        <CodexThumb entry={entry} />
        <div className="min-w-0">
          <p className="font-display text-xs uppercase tracking-widest text-[var(--entry-accent)]">{entry.kicker}</p>
          <h3 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-bone">{entry.title}</h3>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ash">{entry.summary}</p>
    </>
  );

  if (isSamePage) {
    return (
      <article
        id={entry.anchor}
        data-testid="codex-entry"
        data-kind={entry.kind}
        data-slug={entry.slug}
        style={{ ["--entry-accent" as string]: CODEX_ACCENT_HEX[entry.accent] }}
        className="scroll-mt-24 rounded-md border border-gunmetal bg-coal p-5"
      >
        {content}
      </article>
    );
  }

  return (
    <Link
      id={entry.anchor}
      data-testid="codex-entry"
      data-kind={entry.kind}
      data-slug={entry.slug}
      href={entry.href}
      style={{ ["--entry-accent" as string]: CODEX_ACCENT_HEX[entry.accent] }}
      className="scroll-mt-24 rounded-md border border-gunmetal bg-coal p-5 transition-colors hover:border-[var(--entry-accent)]"
    >
      {content}
    </Link>
  );
}

function CodexThumb({ entry }: { entry: PublicCodexEntry }) {
  if (entry.kind === "faction") {
    return (
      <span className="flex size-16 shrink-0 items-center justify-center rounded-md border border-gunmetal bg-iron">
        <FactionCrest accent={entry.accent} className="size-11" />
      </span>
    );
  }

  if (entry.imageUrl) {
    return (
      <span className="relative block size-16 shrink-0 overflow-hidden rounded-md border border-gunmetal bg-iron">
        <Image
          src={entry.imageUrl}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      </span>
    );
  }

  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-md border border-gunmetal bg-iron font-display text-3xl font-bold uppercase text-white/15">
      {entry.title.charAt(0)}
    </span>
  );
}
