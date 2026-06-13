"use client";

import { useUser } from "@clerk/nextjs";
import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { authEnabled, hasCollection, isLockedGameSlug } from "@/lib/access";
import { type AccessState, ACCESS_STATE_PRESENTATION, baseAccessState, resolveAccessState } from "@/lib/access-state";
import type { GameStatus } from "@/lib/content";
import { cn } from "@/lib/utils";

// Player-facing access badge for the game gallery: one of Play now / Preview /
// Waitlist / Locked (see lib/access-state.ts). It supersedes the old StatusBadge +
// GameLockBadge pair on the card. Client-side because the locked⇄available split
// is a Clerk decision and the hub pages stay static otherwise — the proxy gate is
// the real enforcement; this is honest signage. useUser is mounted strictly behind
// `authEnabled` (it requires ClerkProvider, which only renders when Clerk is wired).

const STATE_STYLES: Record<AccessState, string> = {
  available: "border-toxic/50 bg-toxic/10 text-toxic",
  preview: "border-hellfire/50 bg-hellfire/10 text-hellfire",
  waitlist: "border-gunmetal bg-iron text-ash",
  locked: "border-hellfire/50 bg-void/70 text-hellfire",
};

export function AccessStateBadge({ state, className }: { state: AccessState; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-display tracking-widest", STATE_STYLES[state], className)}>
      {state === "locked" ? <Lock className="size-3" aria-hidden /> : null}
      {ACCESS_STATE_PRESENTATION[state].label}
    </Badge>
  );
}

export function GameAccessBadge({ slug, status, className }: { slug: string; status: GameStatus; className?: string }) {
  const gated = authEnabled && isLockedGameSlug(slug);
  // Only a playable, gated game can flip to `locked`, and only when auth is wired
  // (keyless builds read fully open). That decision needs Clerk, so hand off to the
  // hook-bearing inner; every other state is static and resolves without auth.
  if (baseAccessState(status) === "available" && gated) {
    return <GatedAccessBadge status={status} className={className} />;
  }
  return <AccessStateBadge state={resolveAccessState(status, { gated, unlocked: true })} className={className} />;
}

function GatedAccessBadge({ status, className }: { status: GameStatus; className?: string }) {
  const { isLoaded, user } = useUser();
  // Conservative while Clerk hydrates: hold `locked` until we know, so the badge
  // never flashes "Play now" and then yanks it. The proxy gate enforces either way.
  const unlocked = isLoaded && hasCollection(user?.publicMetadata);
  return <AccessStateBadge state={resolveAccessState(status, { gated: true, unlocked })} className={className} />;
}
