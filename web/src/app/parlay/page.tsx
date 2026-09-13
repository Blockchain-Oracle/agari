import type { Metadata } from "next";
import { ParlayScreen } from "@/features/parlay";

export const metadata: Metadata = { title: "Parlay" };

export default function Page() {
  return <ParlayScreen />;
}
