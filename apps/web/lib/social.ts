import type { Metadata } from "next";

export const SITE_NAME = "DEADROT";
export const SITE_URL = "https://deadrot.com";

export interface SocialImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export const DEFAULT_SOCIAL_IMAGE: SocialImage = {
  url: "/images/hero.webp",
  width: 1600,
  height: 759,
  alt: "DEADROT social preview art",
} as const;

export interface SocialMetadataInput {
  title: string;
  description: string;
  path: string;
  openGraphTitle?: string;
  image?: SocialImage;
}

export function createSocialMetadata({
  title,
  description,
  path,
  openGraphTitle,
  image = DEFAULT_SOCIAL_IMAGE,
}: SocialMetadataInput): Metadata {
  const socialTitle = openGraphTitle ?? `${title} - ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image.url],
    },
  };
}

export function createEntitySocialMetadata({
  title,
  description,
  path,
  kind,
}: SocialMetadataInput & { kind: "Bestiary" | "Dossier" | "Faction" }): Metadata {
  return createSocialMetadata({
    title,
    description,
    path,
    openGraphTitle: `${title} - DEADROT ${kind}`,
  });
}
