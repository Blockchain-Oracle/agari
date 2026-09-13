import type { Metadata } from "next";
import { LuckyStage } from "@/features/games";

export const metadata: Metadata = { title: "Lucky" };

export default function Page() {
  return <LuckyStage />;
}
