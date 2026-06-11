import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

import { Grain } from "@/components/site/atmosphere";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { authEnabled } from "@/lib/access";
import { DEFAULT_SOCIAL_IMAGE, SITE_NAME, SITE_URL } from "@/lib/social";

const siteDescription =
  "One brutal, blood-soaked universe — DOOM's gore with Blizzard's cohesion. The Scourge eats worlds; you make it pay. Built live by Ship Shit Games.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DEADROT — we lost the sky. Now we burn it back.",
    template: "%s — DEADROT",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_NAME,
    description: "One blood-soaked universe. Many browser games. The Scourge eats worlds — you make it pay.",
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: siteDescription,
    images: [DEFAULT_SOCIAL_IMAGE.url],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en">
      <body className="min-h-screen bg-void font-body text-ash">
        <Grain />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );

  // Keyless builds (CI, dev without secrets) render without auth entirely —
  // proxy.ts no-ops in lockstep via the same authEnabled flag.
  if (!authEnabled) return page;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#c1121f",
          colorBackground: "#16130f",
          colorText: "#e9e3d6",
          colorTextSecondary: "#a39e93",
          colorInputBackground: "#0c0a08",
          colorInputText: "#e9e3d6",
          borderRadius: "0.375rem",
        },
      }}
    >
      {page}
    </ClerkProvider>
  );
}
