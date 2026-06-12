"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { DeadrotBrand } from "@/components/site/deadrot-brand";
import { authEnabled } from "@/lib/access";
import { cn } from "@/lib/utils";

const WATCH = "https://youtube.com/@shipshitshow";
// The full canon lives in the published Quartz vault (apps/lore -> lore.deadrot.com),
// a separate static deploy from this Next hub.
const CANON = "https://lore.deadrot.com";

interface NavItem {
  label: string;
  href: string;
  /** Opens in a new tab with the ArrowUpRight icon (Canon, Watch). */
  external?: boolean;
  /** Accent color override for the link text. */
  accent?: "toxic" | "hellfire";
  /** Plain <a> for a full document load (Warline is a SPA rewrite, not a Next route). */
  plainAnchor?: boolean;
}

const NAV: NavItem[] = [
  { label: "Games", href: "/#games" },
  { label: "Docs", href: "/docs" },
  { label: "Universe", href: "/universe" },
  { label: "Factions", href: "/universe#factions" },
  { label: "Bestiary", href: "/universe#bestiary" },
  { label: "Canon", href: CANON, external: true },
  // The Warline lobby is the live entry into every game. Plain <a> — /warline/
  // is a rewrite to the SPA (apps/games/warline), not a Next route.
  { label: "Warline", href: "/warline/", accent: "toxic", plainAnchor: true },
  { label: "Watch", href: WATCH, external: true, accent: "hellfire" },
  // Early-access paywall (epic #330): one purchase unlocks every game.
  { label: "Unlock", href: "/unlock/", accent: "hellfire" },
];

// Keyless builds (CI, dev without secrets) have no working purchase funnel —
// don't advertise a dead-end Unlock page. authEnabled is build-time inlined,
// so server and client agree and hydration stays clean.
const VISIBLE_NAV = authEnabled ? NAV : NAV.filter((item) => item.href !== "/unlock/");

// Sign-in / account controls. Clerk components only render when the publishable
// key is configured — without it there is no ClerkProvider and they would throw.
function AuthControls({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  if (!authEnabled) return null;
  const signInClassName = cn(
    mobile && "py-2",
    "font-display text-sm font-bold uppercase tracking-widest",
    (mobile ? MOBILE_COLOR : DESKTOP_COLOR).default,
  );
  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in" onClick={onNavigate} className={signInClassName}>
          Sign in
        </Link>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}

// Exact color/hover class suffixes from the original hand-written anchors.
const DESKTOP_COLOR: Record<NonNullable<NavItem["accent"]> | "default", string> = {
  default: "text-ash transition-colors hover:text-bone",
  toxic: "text-toxic transition-colors hover:text-bone",
  hellfire: "text-hellfire transition-colors hover:text-blood",
};
const MOBILE_COLOR: Record<NonNullable<NavItem["accent"]> | "default", string> = {
  default: "text-ash hover:text-bone",
  toxic: "text-toxic hover:text-bone",
  hellfire: "text-hellfire",
};

function NavLink({ item, mobile, onNavigate }: { item: NavItem; mobile?: boolean; onNavigate?: () => void }) {
  const className = cn(
    item.external && "inline-flex items-center gap-1",
    mobile && "py-2",
    "font-display text-sm font-bold uppercase tracking-widest",
    (mobile ? MOBILE_COLOR : DESKTOP_COLOR)[item.accent ?? "default"],
  );

  const content = (
    <>
      {item.label}
      {item.external ? <ArrowUpRight className="size-3.5" aria-hidden /> : null}
    </>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" onClick={onNavigate} className={className}>
        {content}
      </a>
    );
  }
  if (item.plainAnchor) {
    return (
      <a href={item.href} onClick={onNavigate} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} onClick={onNavigate} className={className}>
      {content}
    </Link>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(() => (typeof window === "undefined" ? false : window.scrollY > 24));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-gunmetal/60 bg-void/85 backdrop-blur-md"
          : "bg-gradient-to-b from-void/80 to-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" aria-label="DEADROT home" className="text-bone">
          <DeadrotBrand variant="target" imageClassName="h-9 w-9 sm:h-10 sm:w-10" />
        </Link>

        {/* xl breakpoint, not md: nine items plus auth controls measure ~1136px
            and overflow every narrower tier (measured at 1024). */}
        <nav className="hidden items-center gap-6 xl:flex">
          {VISIBLE_NAV.map((i) => (
            <NavLink key={i.href} item={i} />
          ))}
          <AuthControls />
        </nav>

        <button
          onClick={() => setOpen((o) => !o)}
          className="text-bone xl:hidden"
          aria-label="Toggle menu"
          type="button"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open ? (
        <nav className="flex flex-col gap-1 border-t border-gunmetal/60 bg-void/95 px-6 py-4 backdrop-blur-md xl:hidden">
          {VISIBLE_NAV.map((i) => (
            <NavLink key={i.href} item={i} mobile onNavigate={() => setOpen(false)} />
          ))}
          <AuthControls mobile onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
    </header>
  );
}
