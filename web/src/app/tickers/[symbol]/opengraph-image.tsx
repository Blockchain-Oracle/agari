import { isTickerSymbol } from "@agari/core/market";
import { OG_COPY } from "@/features/landing/og/copy";
import { siteImage } from "@/features/landing/og/site-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/features/landing/og/theme";
import { tickerImage } from "@/features/landing/og/ticker-image";

/** A ticker's link preview (L-23): regenerated at most every five minutes, as a new close can only land at a bell. */
export const runtime = "nodejs";
export const revalidate = 300;
export const alt = OG_COPY.ticker.routeAlt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const upper = (await params).symbol.toUpperCase();
  // The page itself 404s an unlisted ticker; its preview falls back to the site's rather than erroring.
  return isTickerSymbol(upper) ? tickerImage(upper) : siteImage();
}
