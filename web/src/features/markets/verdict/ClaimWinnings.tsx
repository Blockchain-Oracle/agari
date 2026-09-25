"use client";

import { VOID_HEADLINE } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Verdict } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { invalidateAfterWrite, useClaimables, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Trophy } from "lucide-react";
import { useState } from "react";
import { Hash } from "@/components/data";
import { itemsFromRows } from "@/features/markets/claims/claim-run";
import { redeemOne } from "@/features/markets/claims/useClaimAll";
import { useRedemption } from "@/features/markets/claims/useRedemption";
import { useVoidWords, type GivenVoid } from "@/features/markets/claims/void-line";
import { useVenue } from "@/features/markets/useVenue";
import { diagnosisCopy, VERDICT_UI } from "@/lib/copy";
import { webEnv } from "@/lib/env";
import { useWalletSession } from "@/lib/wallet-session";
import { VerdictStamp } from "./VerdictStamp";
import "./claim-winnings.css";

interface ClaimWinningsProps {
  verdict: Verdict;
  marketId: MarketId;
  symbol: string;
  /** A void's reason, when the caller already holds it (`/dev` fixtures); omitted, a void reads its Window's result. */
  voidGiven?: GivenVoid;
}

/**
 * The reference's `ClaimWinnings` (`components/ClaimWinnings.tsx`), mounted where it mounts it — on the
 * Window's own result. A winner sees the profit as the hero, the return, stake → payout, and one button
 * that collects it; a loser sees "Not this time" with no false cheer. Claiming was a page here (`/claims`);
 * the reference never had one, and the page is gone.
 *
 * Agari's venue works like the reference's keeper again: after a 300 s claim grace the settler's
 * `redeem_for` pays every seat (D-032), so this button hurries it. A Window paid that way says
 * "Paid automatically" with the payout transaction; one the wallet claimed says so with its own.
 *
 * A void is neither (Q-S6-7): the reference only branches on a loss, so a void wore the "You won" trophy. Here it takes
 * the loss card's quiet anatomy with the void stamp, "Returned", Masayume's void line and the reason (spec §3.2).
 */
export function ClaimWinnings({ verdict, marketId, symbol, voidGiven }: ClaimWinningsProps) {
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
  const isVoid = verdict.outcome === "void";
  const voidWords = useVoidWords(marketId, isVoid, voidGiven);
  const won = verdict.outcome !== "loss" && verdict.payoutBase > 0n;
  // Only once the claimables have answered with nothing left for this Window is there a payout to trace.
  const settledOut = won && claimables !== null && isOk(claimables) && items.length === 0;
  const redemption = useRedemption(address, marketId, settledOut);
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
    let failed = false;
    for (const item of items) {
      const result = await redeemOne(submitter, item);
      if (result.patch.diagnosis) {
        setError(diagnosisCopy(result.patch.diagnosis.kind).headline);
        failed = true;
        break;
      }
      if (result.stop) break;
    }
    await invalidateAfterWrite(queryClient, { wallet: address });
    setClaiming(false);
    // A refused claim keeps Collect beside its error: "Paid" only once nothing failed (the claimables then confirm it).
    if (!failed) setClaimed(true);
  };

  if (isVoid) {
    return (
      <div className="cw-loss cw-void">
        <div className="cw-void-head">
          <VerdictStamp outcome="void" size="compact" />
          <div className="cw-void-figure">
            <span className="cw-void-amount">{money(verdict.payoutBase)}</span>
            <span className="cw-void-unit">{symbol}</span>
            <div className="cw-loss-eyebrow">{VERDICT_UI.claim.returned}</div>
          </div>
        </div>
        {voidWords && <div className="cw-loss-eyebrow">{voidWords.shareWord}</div>}
        <p className="cw-loss-body">{voidWords?.headline ?? VOID_HEADLINE}</p>
        {voidWords && <p className="cw-void-reason">{voidWords.reason}</p>}
        <div className="cw-win-flow">
          <span>
            {VERDICT_UI.claim.stake} <span className="cw-num">{money(stake)}</span>
          </span>
          <ArrowRight className="h-3 w-3" />
          <span>
            {VERDICT_UI.claim.returned} <span className="cw-num">{money(verdict.payoutBase)}</span>
          </span>
        </div>
        {error && <p className="cw-error">{error}</p>}
        {collected ? (
          <>
            <div className="cw-paid cw-void-paid">
              <Check className="h-4 w-4" /> {redemption?.byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.paid}
            </div>
            {redemption && (
              <p className="cw-foot">
                {VERDICT_UI.claim.paidTx} <Hash value={redemption.txHash} href={txUrl(redemption.txHash, webEnv.markets.cluster)} />
              </p>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => void collect()} disabled={claiming || !submitter} className="cw-collect cw-void-collect" data-cursor="hover">
              {claiming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {VERDICT_UI.claim.collecting}
                </>
              ) : (
                VERDICT_UI.claim.collect
              )}
            </button>
            <p className="cw-foot">{VERDICT_UI.claim.voidFoot}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="cw-win">
      <div className="cw-win-glow" aria-hidden />
      <div className="cw-win-body">
        <div className="cw-win-eyebrow">
          <Trophy className="h-4 w-4" />
          <span>{!collected ? VERDICT_UI.claim.youWon : redemption?.byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.claimed}</span>
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
          <>
            <div className="cw-paid">
              <Check className="h-4 w-4" /> {redemption?.byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.paid}
            </div>
            {redemption && (
              <p className="cw-foot">
                {VERDICT_UI.claim.paidTx} <Hash value={redemption.txHash} href={txUrl(redemption.txHash, webEnv.markets.cluster)} />
              </p>
            )}
          </>
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
