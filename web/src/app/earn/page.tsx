import type { Metadata } from "next";
import { EarnScreen } from "@/features/earn";

export const metadata: Metadata = { title: "Earn" };

export default function Page() {
  return <EarnScreen />;
}
