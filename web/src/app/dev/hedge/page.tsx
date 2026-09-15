import type { Metadata } from "next";
import { HEDGE } from "@/features/hedge";
import { HedgeFixtures } from "./HedgeFixtures";

export const metadata: Metadata = { title: `Fixtures · ${HEDGE.dev.title}` };

export default function HedgeFixturesPage() {
  return <HedgeFixtures />;
}
