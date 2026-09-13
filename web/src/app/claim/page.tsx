import type { Metadata } from "next";
import { CLAIM, ClaimScreen } from "@/features/x";
import "@/features/x/x-card.css";

export const metadata: Metadata = { title: CLAIM.title };

export default function Page() {
  return <ClaimScreen />;
}
