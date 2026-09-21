import { isMarketId } from "@agari/core/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { readMarketCard } from "@/features/landing/og/market-data";
import { MarketsPage } from "@/features/markets/MarketsPage";
import { formatCadence, MARKETS } from "@/lib/copy";

/**
 * `/markets/<id>` — the shareable address of one Window, which Blinks and receipts hand out.
 *
 * It used to redirect into `/markets?m=<id>`. Both forms name the same Window (UX-DR21) and the query form is what
 * the page writes back as you move around, so the redirect cost nothing to a person. It cost the **link preview**
 * everything: a crawler following a 307 reads the target's metadata, so every shared Window previewed as the generic
 * markets card while `opengraph-image.tsx` — drawn for this Window, five-minute cache — was never asked for.
 *
 * So the path renders. `useResolveDeepLink` reads a Market id from the path as well as `?m=`, which is the whole of
 * what the island needed; everything else on the page is the same composition `/markets` mounts.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isMarketId(id)) return { title: MARKETS.title };
  // Null for a Window the index does not hold, or an index that is slow or down: the page still renders, and a
  // preview that cannot name the Window is better than one that names the wrong one.
  const card = await readMarketCard(id);
  if (!card) return { title: MARKETS.title };
  return {
    title: MARKETS.windowTitle(card.asset, formatCadence(card.intervalSec)),
    description: MARKETS.windowDescription(card.asset, formatCadence(card.intervalSec)),
  };
}

export default async function MarketRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A mistyped link should land somewhere rather than throw, as it did before.
  if (!isMarketId(id)) redirect("/markets");
  return (
    <Suspense fallback={<LoadingState shape="plate" className="px-gutter py-6" />}>
      <MarketsPage />
    </Suspense>
  );
}
