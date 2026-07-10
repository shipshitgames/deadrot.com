import { auth, clerkClient } from "@clerk/nextjs/server";
import { PLAYABLE_GAME_SLUGS, type PlayableGameSlug } from "@deadrot/catalog";

import { authEnabled, hasCollection, isLockedGameSlug } from "@/lib/access";
import { createWarlineReportHandler, readWarlineBrokerConfig, type WarlineAuthorization } from "@/lib/warline-report";

// Authenticated same-origin broker for game -> Warline reports. Vite games never
// receive an authoritative credential: Clerk establishes the player identity on
// this server, and only this route can attach the PartyKit reporter credential.

async function authorizeGame(game: PlayableGameSlug): Promise<WarlineAuthorization> {
  if (!authEnabled || !process.env.CLERK_SECRET_KEY) return { status: "unavailable" };

  try {
    const { sessionClaims, userId } = await auth();
    if (!userId) return { status: "signed-out" };

    // Scourge Survivors follows the existing free-game policy. Every other
    // reportable game requires the same collection marker as the play gate.
    if (!isLockedGameSlug(game)) return { status: "allowed", userId };
    if (sessionClaims?.deadrotCollection === true) return { status: "allowed", userId };

    // Claims can lag a new purchase. Re-check Clerk's authoritative metadata,
    // matching proxy.ts without trusting anything supplied by the Vite client.
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return hasCollection(user.publicMetadata) ? { status: "allowed", userId } : { status: "denied" };
  } catch {
    // Authentication/provider failures must never fall through to an anonymous
    // authoritative write, and must not log provider/config details.
    return { status: "unavailable" };
  }
}

function isReportingGame(value: unknown): value is PlayableGameSlug {
  return typeof value === "string" && (PLAYABLE_GAME_SLUGS as readonly string[]).includes(value);
}

export const POST = createWarlineReportHandler({
  authorizeGame,
  config: readWarlineBrokerConfig,
  fetch: (...args) => fetch(...args),
  isReportingGame,
  now: Date.now,
});
