"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// Wired in the DNS/Vercel pass: set NEXT_PUBLIC_FORMSPREE_ID to the form id.
const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID ?? "";

type Status = "idle" | "submitting" | "success" | "error";

export function Waitlist() {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!FORMSPREE_ID) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("failed");
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="font-display text-lg uppercase tracking-widest text-hellfire">
        You&apos;re on the list. We&apos;ll reach out when it&apos;s time to fight.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="flex-1 rounded-md border border-gunmetal bg-coal px-4 py-3 text-bone placeholder:text-ash/60 focus:border-hellfire focus:outline-none"
      />
      <Button
        type="submit"
        size="xl"
        disabled={status === "submitting"}
        className="font-display uppercase tracking-widest shadow-ember"
      >
        {status === "submitting" ? "Sending…" : "Join the waitlist"}
      </Button>
      {status === "error" ? (
        <p className="w-full text-sm text-blood sm:absolute sm:mt-16">Something went wrong — try again.</p>
      ) : null}
    </form>
  );
}
