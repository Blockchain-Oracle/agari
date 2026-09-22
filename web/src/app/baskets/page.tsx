import type { Metadata } from "next";
import { BASKETS_COPY } from "@/features/baskets/copy";
import { BasketsIndex } from "@/features/baskets/BasketsIndex";

export const metadata: Metadata = { title: BASKETS_COPY.title, description: BASKETS_COPY.intro };

/** `/baskets` (S19, D-124): five baskets of PreStocks names, each a small group of companies bet on together. */
export default function BasketsPage() {
  return <BasketsIndex />;
}
