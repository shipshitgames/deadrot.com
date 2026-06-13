"use client";

import { useUser } from "@clerk/nextjs";
import { Lock } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authEnabled, hasCollection, isLockedGameSlug } from "@/lib/access";

// Client-side gate state so the hub pages stay static — the proxy gate is the
// actual enforcement; this is just honest signage. Everything reads unlocked
// when Clerk isn't configured (keyless CI/dev, gate no-ops in lockstep).
// useUser lives only in the *Inner component, mounted strictly behind authEnabled,
// because the hook requires ClerkProvider. (The gallery's locked badge lives in
// components/game/access-badge.tsx — GameAccessBadge — alongside the other states.)

function useLocked(): boolean {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return false; // optimistic while Clerk hydrates; the gate enforces
  return !hasCollection(user?.publicMetadata);
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
      <Link href={`/unlock/?from=${slug}`}>
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
