"use client";

import type { ClaimableRow } from "@masayume/core/types";
import { keys, useClaimables } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState, ReadingBoundary } from "@/components/states";
import { VaultCreditRows } from "@/features/vault";
import { CLAIM } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useVenue } from "../useVenue";
import { deriveClaimBlocker } from "./claim-blocker";
import { ClaimPlate } from "./ClaimPlate";
import { ClaimSuccessReceipt } from "./ClaimSuccessReceipt";
import { MarketProofRows } from "./MarketProofRows";
import { useClaimAll } from "./useClaimAll";

const proofRows = (marketId: Parameters<typeof MarketProofRows>[0]["marketId"]) => <MarketProofRows marketId={marketId} />;

/** The connected wallet's claimables through the port, the wallet-gas claim run, and the receipt for what landed. */
export function LiveClaimPlate({ className }: { className?: string }) {
  const session = useWalletSession();
  const venue = useVenue();
  const queryClient = useQueryClient();
  const reading = useClaimables(session.address, venue.venueId);
  const { run, claimAll, hasSigner } = useClaimAll();

  if (!session.address) return <EmptyState why={CLAIM.disconnected.why} className={className} />;

  const blocker = deriveClaimBlocker({ session, hasSigner, run });
  const isEmpty = (rows: ClaimableRow[]) => rows.length === 0 && run.status === "idle";
  const retry = () => void queryClient.invalidateQueries({ queryKey: keys.claimables(session.address, venue.venueId) });

  return (
    <>
    <ReadingBoundary reading={reading} shape="plate" isEmpty={isEmpty} empty={CLAIM.empty} retry={retry} className={className}>
      {(rows) => {
        const decimals = rows[0]?.decimals ?? venue.decimals ?? run.items[0]?.decimals ?? 0;
        return (
          <div className="flex flex-col gap-6">
            <ClaimPlate rows={rows} decimals={decimals} run={run} blocker={blocker} onClaimAll={() => void claimAll(rows)} />
            {run.status === "done" && run.finishedAtMs !== null && (
              <ClaimSuccessReceipt items={run.items} decimals={decimals} finishedAtMs={run.finishedAtMs} marketRows={proofRows} />
            )}
          </div>
        );
      }}
    </ReadingBoundary>
    {/* A Vault credit is a withdrawal, not a redeem: listed beside the plate, never inside its sum (AD-1). */}
    <VaultCreditRows className="mt-6" />
    </>
  );
}
