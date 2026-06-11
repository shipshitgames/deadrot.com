import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

import { authEnabled, FREE_GAME_SLUGS, hasCollection, LOCKED_GAME_SLUGS } from "@/lib/access";

// Shell-level game gate (epic #330). Runs BEFORE the next.config rewrites that
// proxy deadrot.com/<slug>/ to each game's Vercel deploy, so this is the single
// choke point for all seven games — the Vite SPAs themselves stay auth-free.
//
//   free games   -> any signed-in account (email capture)
//   locked games -> signed-in + publicMetadata.deadrotCollection (Stripe webhook)
//
// The entitlement is read from sessionClaims.metadata, which requires the Clerk
// dashboard session-token customization { "metadata": "{{user.public_metadata}}" }
// (see apps/web/.env.example). Claims refresh within ~60s of the webhook firing.

const isFreeGameRoute = createRouteMatcher(FREE_GAME_SLUGS.map((slug) => `/${slug}(.*)`));
const isLockedGameRoute = createRouteMatcher(LOCKED_GAME_SLUGS.map((slug) => `/${slug}(.*)`));

const gate = clerkMiddleware(async (auth, req) => {
  if (isFreeGameRoute(req)) {
    await auth.protect();
    return;
  }
  if (isLockedGameRoute(req)) {
    await auth.protect();
    const { sessionClaims } = await auth();
    if (!hasCollection(sessionClaims?.metadata)) {
      const unlock = new URL("/unlock/", req.url);
      unlock.searchParams.set("from", req.nextUrl.pathname.split("/")[1] ?? "");
      return NextResponse.redirect(unlock);
    }
  }
});

// Without Clerk keys (CI, keyless local dev) the gate is a no-op so builds,
// tests, and the dev fleet never depend on auth being configured.
export default function proxy(req: NextRequest, event: Parameters<typeof gate>[1]) {
  if (!authEnabled) return NextResponse.next();
  return gate(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files (game assets included — the
    // playable page is what's gated; raw assets are public anyway, the repo is OSS).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|wasm|mp3|ogg|wav|glb|gltf)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
