"use client";

import { isOk } from "@masayume/core/schemas";
import type { MarketId, Verdict } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { useSubmitter } from "@masayume/markets/react";
import { invalidateAfterWrite, useClaimables } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Trophy } from "lucide-react";
import { useState } from "react";
import { itemsFromRows } from "@/features/markets/claims/claim-run";
import { redeemOne } from "@/features/markets/claims/useClaimAll";
import { useVenue } from "@/features/markets/useVenue";
import { diagnosisCopy, VERDICT_UI } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import "./claim-winnings.css";

interface ClaimWinningsProps {
  verdict: Verdict;
  marketId: MarketId;
  symbol: string;
}

/**
 * The reference's `ClaimWinnings` (`components/ClaimWinnings.tsx`), mounted where it mounts it — on the
 * Window's own result. A winner sees the profit as the hero, the return, stake → payout, and one button
 * that collects it; a loser sees "Not this time" with no false cheer. Claiming was a page here (`/claims`);
 * the reference never had one, and the page is gone.
 *
 * One factual difference from the reference: Yosuku's keeper pays winners automatically and this button
 * only hurries it; on DreamDEX redemption is a call the wallet signs, so the footnote says that instead.
 */
export function ClaimWinnings({ verdict, marketId, symbol }: ClaimWinningsProps) {
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const submitter = useSubmitter();
  const queryClient = useQueryClient();
  const claimables = useClaimables(address, venueId);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = claimables && isOk(claimables) ? claimables.value.filter((row) => row.marketId === marketId) : [];
  const items = itemsFromRows(rows);
  const money = (base: bigint) => formatBaseUnits(base, verdict.decimals);
  const stake = verdict.costBasisBase ?? 0n;
  const profit = verdict.pnlBase > 0n ? verdict.pnlBase : 0n;
  const roi = stake > 0n ? Number((profit * 100n) / stake) : 0;

  if (verdict.outcome === "loss") {
    return (
      <div className="cw-loss">
        <div className="cw-loss-eyebrow">{VERDICT_UI.claim.notThisTime}</div>
        <p className="cw-loss-body">{VERDICT_UI.claim.lossBody}</p>
      </div>
    );
  }
  if (verdict.payoutBase === 0n) return null;
  const collected = claimed || items.length === 0;

  const collect = async () => {
    if (!submitter || !address || items.length === 0) return;
    setClaiming(true);
    setError(null);
    for (const item of items) {
      const result = await redeemOne(submitter, item);
      if (result.patch.diagnosis) {
        setError(diagnosisCopy(result.patch.diagnosis.kind).headline);
        break;
      }
      if (result.stop) break;
    }
    await invalidateAfterWrite(queryClient, { wallet: address });
    setClaiming(false);
    setClaimed(true);
  };

  return (
    <div className="cw-win">
      <div className="cw-win-glow" aria-hidden />
      <div className="cw-win-body">
        <div className="cw-win-eyebrow">
          <Trophy className="h-4 w-4" />
          <span>{collected ? VERDICT_UI.claim.claimed : VERDICT_UI.claim.youWon}</span>
        </div>
        <div className="cw-win-hero">
          <div>
            <div className="cw-win-figure">
              <span className="cw-win-profit">+{money(profit)}</span>
              <span className="cw-win-unit">{symbol}</span>
            </div>
            <div className="cw-win-label">{VERDICT_UI.claim.profit}</div>
          </div>
          {roi > 0 && (
            <div className="cw-win-roi">
              <div className="cw-win-roi-value">+{roi}%</div>
              <div className="cw-win-roi-label">{VERDICT_UI.claim.ret}</div>
            </div>
          )}
        </div>
        <div className="cw-win-flow">
          <span>
            {VERDICT_UI.claim.stake} <span className="cw-num">{money(stake)}</span>
          </span>
          <ArrowRight className="h-3 w-3" />
          <span>
            {VERDICT_UI.claim.payout} <span className="cw-num">{money(verdict.payoutBase)}</span>
          </span>
        </div>
        {error && <p className="cw-error">{error}</p>}
        {collected ? (
          <div className="cw-paid">
            <Check className="h-4 w-4" /> {VERDICT_UI.claim.paid}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => void collect()} disabled={claiming || !submitter} className="cw-collect" data-cursor="hover">
              {claiming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {VERDICT_UI.claim.collecting}
                </>
              ) : (
                VERDICT_UI.claim.collect
              )}
            </button>
            <p className="cw-foot">{VERDICT_UI.claim.foot}</p>
          </>
        )}
      </div>
    </div>
  );
}
