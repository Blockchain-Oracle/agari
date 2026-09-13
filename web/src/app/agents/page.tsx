import type { Metadata } from "next";
import { AgentsScreen } from "@/features/strategies";

export const metadata: Metadata = { title: "Agents" };

export default function Page() {
  return <AgentsScreen />;
}
