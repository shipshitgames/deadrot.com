"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { DeadrotBrand } from "@/components/site/deadrot-brand";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Games", href: "/#games" },
  { label: "Docs", href: "/docs" },
  { label: "Universe", href: "/universe" },
  { label: "Factions", href: "/universe#factions" },
  { label: "Bestiary", href: "/universe#bestiary" },
];
const WATCH = "https://youtube.com/@shipshitshow";
// The full canon lives in the published Quartz vault (apps/lore -> lore.deadrot.com),
// a separate static deploy from this Next hub.
const CANON = "https://lore.deadrot.com";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
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

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="font-display text-sm font-bold uppercase tracking-widest text-ash transition-colors hover:text-bone"
            >
              {i.label}
            </Link>
          ))}
          <a
            href={CANON}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-display text-sm font-bold uppercase tracking-widest text-ash transition-colors hover:text-bone"
          >
            Canon
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          {/* The Warline lobby is the live entry into every game. Plain <a> — /warline/
              is a rewrite to the SPA (apps/games/warline), not a Next route. */}
          <a
            href="/warline/"
            className="font-display text-sm font-bold uppercase tracking-widest text-toxic transition-colors hover:text-bone"
          >
            Warline
          </a>
          <a
            href={WATCH}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-display text-sm font-bold uppercase tracking-widest text-hellfire transition-colors hover:text-blood"
          >
            Watch
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </nav>

        <button
          onClick={() => setOpen((o) => !o)}
          className="text-bone md:hidden"
          aria-label="Toggle menu"
          type="button"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open ? (
        <nav className="flex flex-col gap-1 border-t border-gunmetal/60 bg-void/95 px-6 py-4 backdrop-blur-md md:hidden">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className="py-2 font-display text-sm font-bold uppercase tracking-widest text-ash hover:text-bone"
            >
              {i.label}
            </Link>
          ))}
          <a
            href={CANON}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 py-2 font-display text-sm font-bold uppercase tracking-widest text-ash hover:text-bone"
          >
            Canon
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          <a
            href="/warline/"
            onClick={() => setOpen(false)}
            className="py-2 font-display text-sm font-bold uppercase tracking-widest text-toxic hover:text-bone"
          >
            Warline
          </a>
          <a
            href={WATCH}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 py-2 font-display text-sm font-bold uppercase tracking-widest text-hellfire"
          >
            Watch
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </nav>
      ) : null}
    </header>
  );
}
