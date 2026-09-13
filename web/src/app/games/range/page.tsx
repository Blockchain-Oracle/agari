import type { Metadata } from "next";
import { RangeScreen } from "@/features/range";

export const metadata: Metadata = { title: "Range" };

export default function Page() {
  return <RangeScreen />;
}
