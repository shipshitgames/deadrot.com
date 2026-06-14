import { Bug, GitBranch, Lightbulb, ListChecks, MessageSquarePlus, Rocket } from "lucide-react";

import { CommunityBuildCard } from "@/components/community/community-build-card";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { Button } from "@/components/ui/button";
import {
  CONTRIBUTOR_PRINCIPLES,
  communityBuilds,
  RELEASE_NOTES_URL,
  SITE_FEEDBACK_URL,
  SITE_KNOWN_ISSUES_URL,
} from "@/lib/community";
import { accentVars } from "@/lib/content";
import { builds, hero, metadata as pageMetadata, principles } from "./content";

export const metadata = pageMetadata;

export default function CommunityPage() {
  return (
    <main style={accentVars("hellfire")}>
      <section className="relative overflow-hidden px-6 pt-32 pb-16 sm:pb-20">
        <Backdrop />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void via-void/80 to-void/50" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 className="text-glow mt-5 max-w-4xl font-display text-5xl font-bold uppercase leading-[0.88] tracking-tight text-bone sm:text-7xl">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ash">{hero.lede}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
              <a href={SITE_FEEDBACK_URL} target="_blank" rel="noreferrer">
                <MessageSquarePlus aria-hidden />
                Send Site Feedback
              </a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-hellfire hover:text-hellfire"
            >
              <a href={RELEASE_NOTES_URL} target="_blank" rel="noreferrer">
                <Rocket aria-hidden />
                Release Notes
              </a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-hellfire hover:text-hellfire"
            >
              <a href={SITE_KNOWN_ISSUES_URL} target="_blank" rel="noreferrer">
                <ListChecks aria-hidden />
                Open Reports
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="builds"
        style={accentVars("blood")}
        className="relative scroll-mt-24 overflow-hidden border-t border-gunmetal/40 px-6 py-20 sm:py-24"
      >
        <Backdrop />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Eyebrow>{builds.eyebrow}</Eyebrow>
          <div className="mt-3 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                {builds.title}
              </h2>
              <p className="mt-4 leading-relaxed text-ash">{builds.lede}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {communityBuilds.map((build) => (
                <CommunityBuildCard key={build.slug} build={build} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 border-t border-gunmetal/40 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Eyebrow>{principles.eyebrow}</Eyebrow>
          <div className="mt-3 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-bone sm:text-5xl">
                {principles.title}
              </h2>
              <p className="mt-4 leading-relaxed text-ash">
                A short, honest contract for working in the open. No NDAs, no roadmaps set in stone — just builds you
                can shape while they are still soft.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="font-display uppercase tracking-widest">
                  <a href={SITE_FEEDBACK_URL} target="_blank" rel="noreferrer">
                    <Lightbulb aria-hidden />
                    Pitch an Idea
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-gunmetal font-display uppercase tracking-widest text-bone hover:border-hellfire hover:text-hellfire"
                >
                  <a href="https://github.com/shipshitgames/deadrot.com" target="_blank" rel="noreferrer">
                    <GitBranch aria-hidden />
                    Browse the Repo
                  </a>
                </Button>
              </div>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {CONTRIBUTOR_PRINCIPLES.map((principle, index) => (
                <li key={principle} className="rounded-md border border-gunmetal bg-coal/80 p-5">
                  <span className="font-display text-2xl font-bold text-hellfire">{`0${index + 1}`}</span>
                  <p className="mt-2 text-sm leading-relaxed text-ash">{principle}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-3 rounded-md border border-gunmetal bg-iron/40 p-6">
            <Bug aria-hidden className="size-5 text-hellfire" />
            <p className="text-sm leading-relaxed text-ash">
              Found something broken in a specific game? Use that build's{" "}
              <span className="font-bold text-bone">Report a bug</span> button above — it tags the right build so we can
              triage fast.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
