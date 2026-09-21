import type { Metadata } from "next";
import { SHORT } from "@/features/short";
import { ShortFixtures } from "./ShortFixtures";

export const metadata: Metadata = { title: `Fixtures · ${SHORT.title}` };

export default function ShortFixturesPage() {
  return <ShortFixtures />;
}
