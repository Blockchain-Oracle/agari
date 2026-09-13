import type { Metadata } from "next";
import { LEADERBOARD, LeaderboardScreen } from "@/features/leaderboard";

export const metadata: Metadata = { title: LEADERBOARD.title };

export default function Page() {
  return <LeaderboardScreen />;
}
