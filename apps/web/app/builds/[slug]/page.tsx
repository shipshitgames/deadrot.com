import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { buildNotes, getBuildNote } from "@/lib/build-notes";
import { accentVars } from "@/lib/content";
import { createSocialMetadata } from "@/lib/social";

export function generateStaticParams() {
  return buildNotes.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getBuildNote(slug);
  if (!note) return {};
  return createSocialMetadata({
    title: `${note.title} Build Notes`,
    description: note.summary,
    path: `/builds/${note.slug}`,
    openGraphTitle: `${note.title} - Deadrot Build Notes`,
  });
}

export default async function BuildNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getBuildNote(slug);
  if (!note) notFound();

  return (
    <main style={accentVars("hellfire")}>
      <section className="relative overflow-hidden px-6 pt-32 pb-16">
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Link
            href="/builds"
            className="text-xs font-bold uppercase tracking-[0.25em] text-ash transition-colors hover:text-hellfire"
          >
            ← Build notes
          </Link>
          <Eyebrow className="mt-6">{note.date}</Eyebrow>
          <h1 className="text-glow mt-5 max-w-4xl font-display text-5xl font-bold uppercase leading-[0.9] tracking-tight text-bone sm:text-7xl">
            {note.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ash">{note.summary}</p>
        </div>
      </section>

      <BuildSection title="Highlights" items={note.highlights} />
      <BuildSection title="Game Updates" items={note.gameUpdates} />
      <BuildSection title="Warline / Meta" items={note.warlineAndMeta} />
      <BuildSection title="Assets / Audio" items={note.assetsAndAudio} />
      <BuildSection title="Mobile / Accessibility" items={note.mobileAndAccessibility} />

      <section className="border-t border-gunmetal/40 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Eyebrow>Validation</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
            Evidence
          </h2>
          <div className="mt-10 grid gap-4">
            {note.validation.map((item) => (
              <div key={item.command} className="rounded-md border border-gunmetal bg-coal p-5">
                <code className="block break-words font-mono text-sm text-hellfire">{item.command}</code>
                <p className="mt-3 text-sm leading-relaxed text-ash">{item.result}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function BuildSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-t border-gunmetal/40 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Eyebrow>{title}</Eyebrow>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="rounded-md border border-gunmetal bg-coal p-5 text-sm leading-relaxed text-ash">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
