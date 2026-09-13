import type { Metadata } from "next";
import { ArcadeStage } from "@/features/games";

export const metadata: Metadata = { title: "Line Rider" };

export default function Page() {
  return <ArcadeStage game="line-rider" />;
}
