"use client";

import { useUser } from "@clerk/nextjs";
import { Lock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authEnabled, hasCollection, isLockedGameSlug } from "@/lib/access";
import { cn } from "@/lib/utils";

// Client-side lock state so the hub pages stay static — the proxy gate is the
// actual enforcement; this is just honest signage. Everything reads unlocked
// when Clerk isn't configured (keyless CI/dev, gate no-ops in lockstep).
// useUser lives only in *Inner components, mounted strictly behind authEnabled,
// because the hook requires ClerkProvider.

function useLocked(): boolean {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return false; // optimistic while Clerk hydrates; the gate enforces
  return !hasCollection(user?.publicMetadata);
}

export function GameLockBadge({ slug, className }: { slug: string; className?: string }) {
  if (!authEnabled || !isLockedGameSlug(slug)) return null;
  return <GameLockBadgeInner className={className} />;
}

function GameLockBadgeInner({ className }: { className?: string }) {
  if (!useLocked()) return null;
  return (
    <Badge
      variant="outline"
      className={cn("border-hellfire/50 bg-void/70 font-display tracking-widest text-hellfire", className)}
    >
      <Lock className="size-3" aria-hidden /> Locked
    </Badge>
  );
}

/** "Play Now" on the game detail page, swapped for the unlock CTA when gated. */
export function PlayGateButton({ slug, demo }: { slug: string; demo: string }) {
  if (!authEnabled || !isLockedGameSlug(slug)) return <PlayNowButton demo={demo} />;
  return <PlayGateButtonInner slug={slug} demo={demo} />;
}

function PlayGateButtonInner({ slug, demo }: { slug: string; demo: string }) {
  if (!useLocked()) return <PlayNowButton demo={demo} />;
  return (
    <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
      <Link href={`/unlock?from=${slug}`}>
        <Lock className="size-4" aria-hidden /> Unlock to play
      </Link>
    </Button>
  );
}

function PlayNowButton({ demo }: { demo: string }) {
  return (
    <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
      <a href={demo} target="_blank" rel="noreferrer">
        Play Now
      </a>
    </Button>
  );
}
