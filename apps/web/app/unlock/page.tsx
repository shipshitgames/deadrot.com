import { auth, clerkClient } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/game/game-card";
import { Backdrop } from "@/components/site/atmosphere";
import { Eyebrow } from "@/components/site/eyebrow";
import { BuyButton } from "@/components/unlock/buy-button";
import {
  authEnabled,
  COLLECTION_PRICE_LABEL,
  EARLY_BUYER_CODE,
  EARLY_BUYER_PRICE_LABEL,
  FREE_GAME_SLUGS,
  hasCollection,
  isLockedGameSlug,
  LOCKED_GAME_SLUGS,
} from "@/lib/access";
import { getGame } from "@/lib/content";

export const metadata: Metadata = {
  title: "Unlock the Collection",
  description: "One purchase. Every Deadrot game. Forever.",
};

// Auth state is per-request — this page is always dynamic.
export const dynamic = "force-dynamic";

async function getAccess(): Promise<{ signedIn: boolean; owned: boolean }> {
  if (!authEnabled) return { signedIn: false, owned: false };
  const { userId } = await auth();
  if (!userId) return { signedIn: false, owned: false };
  // Authoritative check (webhook writes publicMetadata; session claims can lag ~60s).
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return { signedIn: true, owned: hasCollection(user.publicMetadata) };
}

/** Next delivers repeated query params as arrays — take the first. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ signedIn, owned }, rawParams] = await Promise.all([getAccess(), searchParams]);
  const params = {
    success: first(rawParams.success),
    canceled: first(rawParams.canceled),
    from: first(rawParams.from),
  };
  // Only honor ?from= for games that are actually behind the paywall.
  const fromGame = params.from && isLockedGameSlug(params.from) ? getGame(params.from) : undefined;
  // Paid, but the webhook/claims haven't landed yet (seconds, up to ~a minute):
  // don't dangle a second buy button under the "payment received" banner.
  const pendingUnlock = Boolean(params.success) && signedIn && !owned;

  const lockedGames = LOCKED_GAME_SLUGS.map(getGame).filter((g) => g !== undefined);
  const freeGames = FREE_GAME_SLUGS.map(getGame).filter((g) => g !== undefined);

  return (
    <main className="relative min-h-screen px-6 pt-32 pb-24">
      <Backdrop />
      <div className="relative z-10 mx-auto max-w-4xl">
        <Eyebrow>Early access</Eyebrow>
        <h1 className="text-glow mt-4 font-display text-5xl font-bold uppercase leading-[0.85] tracking-tight text-bone sm:text-6xl">
          Unlock the whole war
        </h1>

        {params.success ? (
          <p className="mt-6 border border-toxic/50 bg-toxic/10 p-4 text-toxic">
            Payment received. Your access is unlocking now — it can take up to a minute to reach every
            gate. Welcome to the war.
          </p>
        ) : null}
        {params.canceled ? (
          <p className="mt-6 border border-gunmetal bg-iron/40 p-4 text-ash">
            Checkout canceled. The Scourge isn&apos;t going anywhere.
          </p>
        ) : null}
        {fromGame && !owned ? (
          <p className="mt-6 text-lg text-ash">
            <span className="text-bone">{fromGame.title}</span> is part of the Deadrot Collection.
          </p>
        ) : null}

        {owned ? (
          <div className="mt-8">
            <p className="text-lg leading-relaxed text-ash">
              You own the <span className="text-bone">Deadrot Collection</span>. Every gate is open.
            </p>
            <div className="mt-6">
              <a
                href="/warline/"
                className="font-display text-sm font-bold uppercase tracking-widest text-toxic hover:text-bone"
              >
                Enter the war →
              </a>
            </div>
          </div>
        ) : pendingUnlock ? (
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ash">
            Your purchase is being written to your account. Refresh in a few seconds — no need to
            buy again.
          </p>
        ) : (
          <>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ash">
              One purchase, every game — {COLLECTION_PRICE_LABEL}, forever. No subscription, no
              unlock grind. Early buyers: code{" "}
              <span className="font-display text-hellfire">{EARLY_BUYER_CODE}</span> at checkout drops
              it to <span className="text-bone">{EARLY_BUYER_PRICE_LABEL}</span> — first 1,000 only.
            </p>
            <div className="mt-8">
              {authEnabled ? (
                <BuyButton signedIn={signedIn} priceLabel={COLLECTION_PRICE_LABEL} from={fromGame?.slug} />
              ) : (
                <p className="text-sm uppercase tracking-widest text-ash/70">
                  Purchases aren&apos;t wired up in this environment.
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-bone">
              In the collection
            </h2>
            <ul className="mt-4 space-y-3">
              {lockedGames.map((game) => (
                <li key={game.slug} className="flex items-center gap-3">
                  <StatusBadge status={game.status} />
                  <Link href={`/games/${game.slug}`} className="text-ash transition-colors hover:text-bone">
                    {game.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-bone">
              Free with an account
            </h2>
            <ul className="mt-4 space-y-3">
              {freeGames.map((game) => (
                <li key={game.slug} className="flex items-center gap-3">
                  <StatusBadge status={game.status} />
                  <Link href={`/games/${game.slug}`} className="text-ash transition-colors hover:text-bone">
                    {game.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
