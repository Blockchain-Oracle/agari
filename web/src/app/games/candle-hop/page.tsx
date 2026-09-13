import type { Metadata } from "next";
import { ArcadeStage } from "@/features/games";

export const metadata: Metadata = { title: "Candle Hop" };

export default function Page() {
  return <ArcadeStage game="candle-hop" />;
}
