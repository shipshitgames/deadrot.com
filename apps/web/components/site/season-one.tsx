import Link from "next/link";

import { Eyebrow } from "@/components/site/eyebrow";
import { accentVars } from "@/lib/content";
import { type FrontOperation, frontOperations, SEASON_ONE } from "@/lib/season-one";

function OperationItem({ op }: { op: FrontOperation }) {
  return (
    <li
      data-testid="front-operation"
      data-slug={op.slug}
      style={accentVars(op.accent)}
      className="rounded-md border border-gunmetal bg-coal/60 transition-colors hover:border-[var(--page-accent)]"
    >
      <Link href={`/games/${op.slug}`} className="block p-5">
        <span
          data-testid="front-operation-label"
          className="font-display text-xs font-bold uppercase tracking-[0.35em] text-[var(--page-accent)]"
        >
          {op.operation}
        </span>
        <h3 className="mt-2 font-display text-xl font-bold uppercase tracking-tight text-bone">{op.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ash">{op.line}</p>
      </Link>
    </li>
  );
}

export function SeasonOne() {
  return (
    <section
      data-testid="season-one"
      id="season-one"
      style={accentVars("hellfire")}
      className="relative scroll-mt-16 border-t border-gunmetal/40 px-6 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <Eyebrow>{SEASON_ONE.kicker}</Eyebrow>
        <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
          {SEASON_ONE.title}
        </h2>
        <p data-testid="season-one-lede" className="mt-5 max-w-2xl leading-relaxed text-ash">
          {SEASON_ONE.lede}
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SEASON_ONE.beats.map((beat) => (
            <div key={beat.title} className="rounded-md border border-gunmetal bg-coal/60 p-5">
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-[var(--page-accent)]">
                {beat.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ash">{beat.body}</p>
            </div>
          ))}
        </div>

        <ul data-testid="front-operations" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {frontOperations.map((op) => (
            <OperationItem key={op.slug} op={op} />
          ))}
        </ul>

        <p className="mt-10 max-w-2xl leading-relaxed text-ash">{SEASON_ONE.close}</p>
      </div>
    </section>
  );
}
