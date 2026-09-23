import type { Metadata } from "next";
import { PROOF_FEED, ProofFeedScreen } from "@/features/proof";

export const metadata: Metadata = { title: PROOF_FEED.title };

/** `/proof` (S25): the settled Windows across every lane, each opening its `/proof/<market>` page. */
export default function Page() {
  return <ProofFeedScreen />;
}
