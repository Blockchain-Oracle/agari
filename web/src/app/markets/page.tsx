import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { MarketsPage } from "@/features/markets/MarketsPage";
import { MARKETS } from "@/lib/copy";

export const metadata: Metadata = { title: MARKETS.title };

/** Static shell: the client island reads `?m=&dir=` itself, so nothing here depends on the request. */
export default function MarketsRoute() {
  return (
    <Suspense fallback={<LoadingState shape="plate" className="px-gutter py-6" />}>
      <MarketsPage />
    </Suspense>
  );
}
