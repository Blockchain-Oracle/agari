import type { Metadata } from "next";
import { RANGE } from "@/features/range";
import { RangeFixtures } from "./RangeFixtures";

export const metadata: Metadata = { title: `Fixtures · ${RANGE.devTitle}` };

export default function RangeFixturesPage() {
  return <RangeFixtures />;
}
