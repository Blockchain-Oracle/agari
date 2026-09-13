import type { Metadata } from "next";
import { STATS, StatsPage } from "@/features/stats";

export const metadata: Metadata = { title: STATS.title };

export default function Page() {
  return <StatsPage />;
}
