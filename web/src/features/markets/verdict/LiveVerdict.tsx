"use client";

import type { MarketId } from "@masayume/core/types";
import { EmptyState, LoadingState, ReadingBoundary } from "@/components/states";
import { SETTLING, VERDICT_UI } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useBoot } from "@/providers";
import { useVerdict } from "./useVerdict";
import { VerdictCard } from "./VerdictCard";

const FALLBACK_SYMBOL = "";

/** Mount this for a window at or past expiry: it shows "Settling…" until the chain resolves, then the wallet's one verdict. */
export function LiveVerdict({ marketId }: { marketId: MarketId }) {
  const { address } = useWalletSession();
  const boot = useBoot();
  const symbol = boot?.ok ? boot.value.collateral.symbol : FALLBACK_SYMBOL;
  const state = useVerdict({ marketId, wallet: address });

  if (state.phase === "open") return null;
  if (!address) return <EmptyState why={VERDICT_UI.connect.why} />;
  if (state.phase === "settling") {
    return (
      <p className="type-body text-ink-secondary" role="status">
        <span className="type-body-strong text-ink">{SETTLING}</span> {VERDICT_UI.settling}
      </p>
    );
  }

  return (
    <ReadingBoundary reading={state.market} shape="plate" isEmpty={(m) => m === null} empty={VERDICT_UI.notFound}>
      {(market) =>
        market && (
          <ReadingBoundary reading={state.verdict} shape="plate" isEmpty={(v) => v === null} empty={VERDICT_UI.noPosition}>
            {(verdict) =>
              verdict ? (
                <VerdictCard key={verdict.marketId} verdict={verdict} market={market} resolution={state.resolution?.ok ? state.resolution.value : null} symbol={symbol} />
              ) : (
                <LoadingState shape="plate" />
              )
            }
          </ReadingBoundary>
        )
      }
    </ReadingBoundary>
  );
}
