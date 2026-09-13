import type { Metadata } from "next";
import { LEVERAGE } from "@/features/leverage";
import { LeverageFixtures } from "./LeverageFixtures";

export const metadata: Metadata = { title: `Fixtures · ${LEVERAGE.devTitle}` };

export default function LeverageFixturesPage() {
  return <LeverageFixtures />;
}
