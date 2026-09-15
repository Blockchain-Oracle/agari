import { isAddress, toMarketId } from "@agari/core/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PROOF, ProofScreen } from "@/features/proof";
import { MARKETS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: PROOF.title };

/** `/proof/<market>`: a malformed id goes back to the markets (routing law: nothing 404s). */
export default async function Page({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  if (!isAddress(market)) redirect(MARKETS_PATH);
  return <ProofScreen marketId={toMarketId(market)} />;
}
