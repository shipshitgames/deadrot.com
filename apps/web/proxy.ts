import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

import { authEnabled, FREE_GAME_SLUGS, hasCollection, LOCKED_GAME_SLUGS } from "@/lib/access";

// Shell-level game gate (epic #330). In prod this runs BEFORE the next.config
// rewrites that proxy deadrot.com/<slug>/ to each game's Vercel deploy, so it
// is the single choke point for all seven games — the Vite SPAs stay auth-free.
// (In dev the game slugs are next.config redirects to localhost ports, and
// redirects run before middleware, so the gate only enforces in prod builds.)
//
//   free games   -> any signed-in account (email capture)
//   locked games -> signed-in + publicMetadata.deadrotCollection (Stripe webhook)
//
// The entitlement is read from sessionClaims.metadata, which requires the Clerk
// dashboard session-token customization { "metadata": "{{user.public_metadata}}" }
// (see apps/web/.env.example). Claims refresh within ~60s of the webhook firing.

const isFreeGameRoute = createRouteMatcher(FREE_GAME_SLUGS.map((slug) => `/${slug}(.*)`));
const isLockedGameRoute = createRouteMatcher(LOCKED_GAME_SLUGS.map((slug) => `/${slug}(.*)`));

// Send signed-out players to our own /sign-in page (not the Clerk Account
// Portal) and bring them back to the game they were opening.
function signInUrl(req: NextRequest): string {
  const url = new URL("/sign-in/", req.url);
  url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
  return url.toString();
}

const gate = clerkMiddleware(async (auth, req) => {
  if (isFreeGameRoute(req)) {
    await auth.protect({ unauthenticatedUrl: signInUrl(req) });
    return;
  }
  if (isLockedGameRoute(req)) {
    await auth.protect({ unauthenticatedUrl: signInUrl(req) });
    const { sessionClaims, userId } = await auth();
    if (hasCollection(sessionClaims?.metadata)) return;
    // Session claims lag publicMetadata by up to ~60s after the webhook grants
    // the entitlement. Re-check the user record before bouncing a player who
    // may have just paid — only visitors without the claim pay this API call.
    const client = await clerkClient();
    const user = userId ? await client.users.getUser(userId).catch(() => null) : null;
    if (user && hasCollection(user.publicMetadata)) return;
    const unlock = new URL("/unlock/", req.url);
    unlock.searchParams.set("from", req.nextUrl.pathname.split("/")[1] ?? "");
    return NextResponse.redirect(unlock);
  }
});

// Without BOTH Clerk keys the gate is a no-op so builds, tests, and the dev
// fleet never depend on auth being configured. The secret-key check matters:
// clerkMiddleware with only the publishable key throws on every matched
// request — a half-configured deploy should fail open, not take the site down.
export default function proxy(req: NextRequest, event: Parameters<typeof gate>[1]) {
  if (!authEnabled || !process.env.CLERK_SECRET_KEY) return NextResponse.next();
  return gate(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets — but NOT .html: /<slug>/index.html
    // is the playable Vite entry document and must hit the gate like /<slug>/.
    // Raw js/css/media assets stay public (the repo is OSS anyway).
    "/((?!_next|[^?]*\\.(?:css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|wasm|mp3|ogg|wav|glb|gltf)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
