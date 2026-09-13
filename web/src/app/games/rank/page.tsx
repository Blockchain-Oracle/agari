import type { Metadata } from "next";
import { DuelRank } from "@/features/games/duel/DuelRank";

export const metadata: Metadata = { title: "The ladder" };

export default function Page() {
  return <DuelRank />;
}
