import type { Metadata } from "next";
import { MoonshotScreen } from "@/features/games/moonshot";

export const metadata: Metadata = { title: "Moonshot" };

export default function Page() {
  return <MoonshotScreen />;
}
