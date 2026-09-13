import type { Metadata } from "next";
import { PitchDeck } from "@/features/pitch";

export const metadata: Metadata = { title: "Pitch" };

/** The folio — the reference's presentation grammar, every claim on real Masayume evidence. */
export default function Page() {
  return <PitchDeck />;
}
