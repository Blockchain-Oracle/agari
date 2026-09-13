import type { Metadata } from "next";
import { DuelStage } from "@/features/games";

export const metadata: Metadata = { title: "Prediction duel" };

export default function Page() {
  return <DuelStage />;
}
