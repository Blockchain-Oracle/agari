import type { Metadata } from "next";
import { DuelHistory } from "@/features/games/duel/DuelHistory";
import { LuckyHistory } from "@/features/games/lucky/LuckyHistory";

export const metadata: Metadata = { title: "Your games" };

/** The duels first, then the spins: two sections, one page, each from its own record. */
export default function Page() {
  return (
    <>
      <DuelHistory />
      <LuckyHistory />
    </>
  );
}
