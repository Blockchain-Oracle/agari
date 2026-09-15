import type { Metadata } from "next";
import { SESSION } from "@/features/session";
import { MarketSessionFixtures } from "./MarketSessionFixtures";
import { SessionFixtures } from "./SessionFixtures";

export const metadata: Metadata = { title: `Fixtures · ${SESSION.dev.title}` };

export default function SessionFixturesPage() {
  return (
    <>
      <MarketSessionFixtures />
      <SessionFixtures />
    </>
  );
}
