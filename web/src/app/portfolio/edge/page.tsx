import type { Metadata } from "next";
import { EDGE, TraderEdgeScreen } from "@/features/edge";

export const metadata: Metadata = { title: EDGE.title };

export default function Page() {
  return <TraderEdgeScreen />;
}
