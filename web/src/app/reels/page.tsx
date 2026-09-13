import type { Metadata } from "next";
import { ReelsScreen } from "@/features/markets/reels";
import { REELS } from "@/lib/copy";

export const metadata: Metadata = { title: REELS.title };

export default function Page() {
  return <ReelsScreen />;
}
