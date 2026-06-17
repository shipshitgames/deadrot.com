import type { Metadata } from "next";
import Link from "next/link";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { buildNotes } from "@/lib/build-notes";
import { accentVars } from "@/lib/content";
import { createSocialMetadata } from "@/lib/social";

export const metadata: Metadata = createSocialMetadata({
  title: "Build Notes",
  description:
    "Recent Deadrot build notes with highlights, game updates, validation evidence, and shippability checks.",
  path: "/builds",
  openGraphTitle: "Deadrot Build Notes",
});

export default function BuildsPage() {
  return (
    <main style={accentVars("hellfire")}>
      <section className="relative overflow-hidden px-6 pt-32 pb-16">
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>News / Builds</Eyebrow>
          <h1 className="text-glow mt-5 max-w-4xl font-display text-5xl font-bold uppercase leading-[0.9] tracking-tight text-bone sm:text-7xl">
            Build Notes
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ash">
            Player-facing updates for preview builds: what changed, what it affects, and which validation commands ran.
          </p>
        </div>
      </section>

      <section className="border-t border-gunmetal/40 px-6 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-5">
          {buildNotes.map((note) => (
            <Link
              key={note.slug}
              href={`/builds/${note.slug}`}
              data-testid="build-note"
              className="rounded-md border border-gunmetal bg-coal p-6 transition-colors hover:border-hellfire"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-xs uppercase tracking-widest text-hellfire">{note.date}</p>
                  <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-bone">
                    {note.title}
                  </h2>
                </div>
                <span className="font-display text-xs uppercase tracking-widest text-gunmetal">
                  {note.validation.length} checks
                </span>
              </div>
              <p className="mt-4 max-w-4xl leading-relaxed text-ash">{note.summary}</p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {note.highlights.slice(0, 4).map((highlight) => (
                  <li key={highlight} className="border-l-2 border-hellfire pl-3 text-sm leading-relaxed text-ash">
                    {highlight}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
