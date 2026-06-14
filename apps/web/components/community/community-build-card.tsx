import { Bug, ExternalLink, Lightbulb, ListChecks } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { CommunityBuild } from "@/lib/community";
import { accentVars } from "@/lib/content";

// One open-preview build: phase badge, what feedback is most useful right now,
// and the three GitHub deep links (report a bug, suggest an idea, browse open
// reports). Accent-tinted via the nearest `--page-accent`.
export function CommunityBuildCard({ build }: { build: CommunityBuild }) {
  return (
    <article
      data-testid="community-build"
      data-slug={build.slug}
      style={accentVars(build.accent)}
      className="flex flex-col rounded-md border border-gunmetal bg-coal/85 p-5 transition-all hover:border-[var(--page-accent)] hover:shadow-[0_0_36px_-18px_var(--page-accent)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="community-phase"
          className="rounded-sm border border-[var(--page-accent)]/50 bg-[var(--page-accent)]/10 px-2 py-1 font-display text-[0.6rem] font-bold uppercase tracking-widest text-[var(--page-accent)]"
        >
          {build.phase.label}
        </span>
        <span className="text-[0.65rem] uppercase tracking-widest text-ash">{build.genre}</span>
      </div>

      <h3 className="mt-4 font-display text-2xl font-bold uppercase leading-none tracking-tight text-bone">
        {build.title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-ash">
        <span className="font-bold uppercase tracking-widest text-[var(--page-accent)]">Focus:</span> {build.focus}
      </p>

      <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="font-display uppercase tracking-widest">
            <a href={build.bugUrl} target="_blank" rel="noreferrer" aria-label={`Report a bug in ${build.title}`}>
              <Bug aria-hidden />
              Report a bug
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]"
          >
            <a href={build.ideaUrl} target="_blank" rel="noreferrer" aria-label={`Suggest an idea for ${build.title}`}>
              <Lightbulb aria-hidden />
              Suggest an idea
            </a>
          </Button>
        </div>
        <Link
          href={build.knownIssuesUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ash transition-colors hover:text-[var(--page-accent)]"
        >
          <ListChecks aria-hidden className="size-3.5" />
          Known issues
          <ExternalLink aria-hidden className="size-3" />
        </Link>
      </div>
    </article>
  );
}
