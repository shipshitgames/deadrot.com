import Link from "next/link";
import { FactionCrest } from "@/components/faction/faction-crest";
import { Eyebrow } from "@/components/site/eyebrow";
import { accentVars, factions } from "@/lib/content";

/**
 * The shared "#factions" section body: the Choose a Side header plus the
 * faction card grid. Rendered identically on the home and universe pages;
 * the pages own the surrounding <section> wrapper.
 */
export function FactionCardGrid() {
  return (
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
  );
}
