import type { Bytes32 } from "@masayume/core/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DuelStage } from "@/features/games";

export const metadata: Metadata = { title: "Prediction duel" };

/**
 * `/games/duel/[matchId]` — Flicky's `/game/play/:duelId` and `/game/duel/:id` in one: a seat resumes
 * the match here (reload-safe, shareable), anyone else reads its result. The id is the arena's bytes32.
 */
export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(matchId)) notFound();
  return <DuelStage resumeMatchId={matchId.toLowerCase() as Bytes32} />;
}
