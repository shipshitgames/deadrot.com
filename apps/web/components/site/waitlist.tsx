"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

type Status = "idle" | "submitting" | "success" | "error";

// Joins the Deadrot access waitlist via the first-party route (#355). Posts to
// /api/waitlist/ (same-origin; the trailing slash dodges the trailingSlash:true
// 308 hop on the POST) instead of a third-party form, so capture + validation +
// follow-up wiring all live in the repo (see app/api/waitlist/route.ts).

export function Waitlist({ source = "site-waitlist" }: { source?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // The success message replaces the whole form, so the submit button that had
  // focus is gone. Pull focus to the confirmation so keyboard/SR users are landed
  // on it (role="status" announces, but focus would otherwise reset to the body).
  const focusOnMount = useCallback((node: HTMLParagraphElement | null) => {
    node?.focus();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const company = data.get("company");

    // Honeypot tripped on the client: pretend success, send nothing.
    if (typeof company === "string" && company.trim()) {
      form.reset();
      setStatus("success");
      return;
    }

    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/waitlist/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), source, company }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Something went wrong — try again.");
      form.reset();
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p
        ref={focusOnMount}
        tabIndex={-1}
        role="status"
        className="font-display text-lg uppercase tracking-widest text-hellfire focus:outline-none"
      >
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
        aria-describedby="waitlist-error"
        aria-invalid={status === "error" ? true : undefined}
        className="flex-1 rounded-md border border-gunmetal bg-coal px-4 py-3 text-bone placeholder:text-ash/60 focus:border-hellfire focus:outline-none"
      />
      {/* Honeypot: hidden from humans + assistive tech, catnip for naive bots. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <Button
        type="submit"
        size="xl"
        disabled={status === "submitting"}
        className="font-display uppercase tracking-widest shadow-ember"
      >
        {status === "submitting" ? "Sending…" : "Join the waitlist"}
      </Button>
      <p id="waitlist-error" role="alert" className="w-full text-sm text-blood sm:absolute sm:mt-16">
        {status === "error" ? (error ?? "Something went wrong — try again.") : null}
      </p>
    </form>
  );
}
