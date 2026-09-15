import type { Metadata } from "next";
import { BRAND } from "@/lib/copy";
import { LANDING, LandingPage } from "@/features/landing";

/**
 * The landing shares its own words when linked: Next replaces, not merges, a page-level `openGraph`/`twitter` block,
 * so the site name, type, locale and card repeat the layout's. The file-based `opengraph-image` still attaches.
 */
export const metadata: Metadata = {
  title: { absolute: LANDING.meta.title },
  description: LANDING.meta.description,
  openGraph: { type: "website", siteName: BRAND.name, locale: "en_US", title: LANDING.meta.title, description: LANDING.meta.description },
  twitter: { card: "summary_large_image", title: LANDING.meta.title, description: LANDING.meta.description },
};

/** `/` is the landing (L-11, D-093): a static shell with three client islands, so nothing here depends on the request. */
export default function Home() {
  return <LandingPage />;
}
