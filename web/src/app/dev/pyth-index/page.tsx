import type { Metadata } from "next";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { PythIndexFixtures } from "./PythIndexFixtures";

export const metadata: Metadata = { title: `Fixtures · ${TICKER_HUB.dev.title}` };

export default function PythIndexFixturesPage() {
  return <PythIndexFixtures />;
}
