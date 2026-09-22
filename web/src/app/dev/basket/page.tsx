import type { Metadata } from "next";
import { BASKETS_COPY } from "@/features/baskets/copy";
import { BasketFixtures } from "./BasketFixtures";

export const metadata: Metadata = { title: `Fixtures · ${BASKETS_COPY.dev.title}` };

export default function BasketFixturesPage() {
  return <BasketFixtures />;
}
