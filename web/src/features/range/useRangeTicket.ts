"use client";

import type { BlockerContext, BlockerKind } from "@masayume/core/copy";
import type { MarketPhase } from "@masayume/core/lifecycle";
import type { RangeReserveState } from "@masayume/core/range";
import { RANGE_STAKE_HEADROOM_BPS } from "@masayume/core/range";
import { belowMinStake, minStakeBase } from "@masayume/core/sizing";
import type { EventMarket, Hex } from "@masayume/core/types";
import { formatBaseUnits, mulBpsCeil } from "@masayume/core/units";
import { useCallback, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import type { WalletSession } from "@/lib/wallet-session";
import { useOracleSpot } from "../markets/hero/useOracleSpot";
import { RANGE } from "./copy";
import { usdBand } from "./format";
import { useRangeDraft, type RangeDraft } from "./useRangeDraft";
import { useRangeQuote, type RangeQuoteState } from "./useRangeQuote";
import { useRangeWrites } from "./useRangeWrites";

interface UseRangeTicketInput {
  market: EventMarket;
  phase: MarketPhase | null;
  decimals: number;
  symbol: string;
  /** Null where no reserve is deployed; the hook then quotes nothing and blocks on it. */
  reserve: RangeReserveState | null;
  stakeBase: bigint;
  /** Wallet spendable plus venue credit; null until the balance sheet has answered. */
  availableBase: bigint | null;
  session: WalletSession;
  hasSigner: boolean;
  /** False while the ticket is on Up/Down: the band is not drawn and the reserve is not asked. */
  enabled: boolean;
}

export interface RangeTicketApi {
  draft: RangeDraft;
  quoteState: RangeQuoteState;
  quote: RangeQuoteState["quote"];
  blocker: BlockerKind | null;
  ctx: BlockerContext;
  place: () => Promise<void>;
  placed: { txHash: Hex; band: string } | null;
  reset: () => void;
  /** The reserve's stake with the headroom the open is sent with, for the caption. */
  upToText: string | null;
}

const PHASE_BLOCKERS: Partial<Record<MarketPhase, BlockerKind>> = {
  upcoming: "upcoming",
  pendingOpeningPrint: "pending-opening-print",
  noEntryBuffer: "no-entry-buffer",
  locked: "locked",
  settledUnclaimed: "locked",
  finalized: "locked",
  voided: "locked",
};

/**
 * The Ticket's range mode (`Ticket624Drawer.tsx` range branch), as the state the one ticket composes from:
 * the band around the live price, the reserve's own quote, the ladder, and the place. The band control
 * takes the side block's place and the shared amount block, strip and CTA do the rest — the reference keeps
 * range inside the same drawer rather than swapping the ticket for another one. Inside only, as the
 * reference; the game page offers outside too.
 */
export function useRangeTicket(p: UseRangeTicketInput): RangeTicketApi {
  const { market, phase, decimals, symbol, reserve, stakeBase, availableBase, session, hasSigner, enabled } = p;
  const spot = useOracleSpot(market.asset);
  const draft = useRangeDraft(spot, market.intervalSec);
  const writes = useRangeWrites();
  const [placed, setPlaced] = useState<{ txHash: Hex; band: string } | null>(null);
  const band = draft.lowPrint !== null && draft.highPrint !== null ? { marketId: market.marketId, asset: market.asset, side: "inside" as const, lowPrint: draft.lowPrint, highPrint: draft.highPrint } : null;
  const quoteState = useRangeQuote({
    band,
    expirySec: market.expirySec,
    mode: { kind: "fixStake", stakeBase },
    params: reserve?.params ?? null,
    enabled: enabled && reserve !== null && hasSigner && phase === "trading" && !reserve.paused && !draft.dragging,
  });
  const { quote } = quoteState;

  const blocker = ((): BlockerKind | null => {
    if (!session.isConnected) return session.isConnecting ? "connecting" : "disconnected";
    if (!session.isRightChain) return "wrong-chain";
    if (!hasSigner) return "connecting";
    if (writes.busy === "open") return "placing";
    if (phase === null) return "syncing";
    const phaseBlocker = PHASE_BLOCKERS[phase];
    if (phaseBlocker) return phaseBlocker;
    if (availableBase === 0n) return "no-funds";
    if (band === null) return "quoting";
    if (stakeBase === 0n) return "no-stake";
    if (belowMinStake(stakeBase, decimals)) return "below-min-stake";
    if (availableBase !== null && stakeBase > availableBase) return "over-balance";
    if (quoteState.error) return "quote-refused";
    if (quoteState.loading || !quote) return "quoting";
    return null;
  })();
  const ctx: BlockerContext = { minStakeText: `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}` };

  const place = useCallback(async () => {
    if (!band || !quote) return;
    const bandText = `${usdBand(band.lowPrint)} to ${usdBand(band.highPrint)}`;
    const outcome = await writes.open({ ...band, maxPayoutBase: quote.maxPayoutBase, maxStakeBase: mulBpsCeil(quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS) });
    if (!outcome) return;
    if (outcome.status === "confirmed") {
      setPlaced({ txHash: outcome.txHash, band: bandText });
      notify.neutral(RANGE.ticket.toast(bandText, formatBaseUnits(outcome.stakeBase, decimals), formatBaseUnits(quote.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), symbol));
      return;
    }
    if (outcome.status === "requote") {
      notify.warning(diagnosisCopy("requote").headline, RANGE.ticket.requote(formatBaseUnits(outcome.stakeBase, decimals), symbol));
      quoteState.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    notify.warning(copy.headline, outcome.diagnosis.technical || copy.body);
  }, [band, quote, writes, decimals, symbol, quoteState]);

  const upToText = quote && !quoteState.error ? RANGE.ticket.upTo(formatBaseUnits(mulBpsCeil(quote.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS), decimals), symbol) : null;

  return { draft, quoteState, quote, blocker, ctx, place, placed, reset: () => setPlaced(null), upToText };
}
