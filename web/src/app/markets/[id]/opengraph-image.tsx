import { OG_COPY } from "@/features/landing/og/copy";
import { marketImage } from "@/features/landing/og/market-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/features/landing/og/theme";

/** A Window's link preview (L-23): five minutes of cache, the shortest cadence, so a card never outlives a Window's state by more. */
export const runtime = "nodejs";
export const revalidate = 300;
export const alt = OG_COPY.market.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  return marketImage((await params).id);
}
