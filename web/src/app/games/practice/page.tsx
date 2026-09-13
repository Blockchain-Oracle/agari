import type { Metadata } from "next";
import { PracticeStage } from "@/features/games";

export const metadata: Metadata = { title: "Practice" };

export default function Page() {
  return <PracticeStage />;
}
