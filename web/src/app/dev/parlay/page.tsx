import type { Metadata } from "next";
import { PARLAY } from "@/features/parlay";
import { ParlayFixtures } from "./ParlayFixtures";

export const metadata: Metadata = { title: `Fixtures · ${PARLAY.devTitle}` };

export default function ParlayFixturesPage() {
  return <ParlayFixtures />;
}
