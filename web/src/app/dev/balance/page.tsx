import type { Metadata } from "next";
import { BALANCE } from "@/lib/copy";
import { BalanceFixtures } from "./BalanceFixtures";

export const metadata: Metadata = { title: `Fixtures · ${BALANCE.devTitle}` };

export default function BalanceFixturesPage() {
  return <BalanceFixtures />;
}
