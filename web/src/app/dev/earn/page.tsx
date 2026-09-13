import type { Metadata } from "next";
import { EARN } from "@/features/earn";
import { EarnFixtures } from "./EarnFixtures";

export const metadata: Metadata = { title: `Fixtures · ${EARN.devTitle}` };

export default function EarnFixturesPage() {
  return <EarnFixtures />;
}
