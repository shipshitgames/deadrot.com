"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function BuyButton({ signedIn, priceLabel }: { signedIn: boolean; priceLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Button asChild size="xl" className="font-display uppercase tracking-widest shadow-ember">
        <a href="/sign-in/?redirect_url=/unlock/">Sign in to unlock — {priceLabel}</a>
      </Button>
    );
  }

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        size="xl"
        onClick={buy}
        disabled={busy}
        className="font-display uppercase tracking-widest shadow-ember"
      >
        {busy ? "Opening checkout…" : `Unlock everything — ${priceLabel}`}
      </Button>
      {error ? <p className="text-sm text-blood">{error}</p> : null}
    </div>
  );
}
