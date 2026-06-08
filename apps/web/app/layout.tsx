import type { Metadata } from "next";
import "./globals.css";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Grain } from "@/components/site/atmosphere";

export const metadata: Metadata = {
  metadataBase: new URL("https://deadrot.com"),
  title: {
    default: "DEADROT — we lost the sky. Now we burn it back.",
    template: "%s — DEADROT",
  },
  description:
    "One brutal, blood-soaked universe — DOOM's gore with Blizzard's cohesion. The Scourge eats worlds; you make it pay. Built live by Ship Shit Games.",
  openGraph: {
    title: "DEADROT",
    description: "One blood-soaked universe. Many browser games. The Scourge eats worlds — you make it pay.",
    url: "https://deadrot.com",
    siteName: "DEADROT",
    type: "website",
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
  return (
    <html lang="en">
      <body className="min-h-screen bg-void font-body text-ash">
        <Grain />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
