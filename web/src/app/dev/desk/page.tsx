import type { Metadata } from "next";
import { DeskFixtures } from "./DeskFixtures";

export const metadata: Metadata = { title: "Fixtures · The desk" };

/** `/dev/desk` (S21, plan §5.11): every desk state from fixtures, for judges and U.S. visitors with no wallet. */
export default function DeskFixturesPage() {
  return <DeskFixtures />;
}
