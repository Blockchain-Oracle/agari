"use client";

import { formatCadence, type BlockerContext } from "@masayume/core/copy";
import { luckyDrifted } from "@masayume/core/games";
import { phase as phaseOf } from "@masayume/core/lifecycle";
import type { BookedOrder } from "@masayume/core/ports";
import { isOk } from "@masayume/core/schemas";
import { minStakeBase } from "@masayume/core/sizing";
import { toMarketId, type EventMarket, type Hex } from "@masayume/core/types";
import { bpsToOddsCents, formatBaseUnits, formatClock } from "@masayume/core/units";
import { useBalanceSheet, useMarket, useOnchain, useOpeningPrice, useSigner, useStakeQuote } from "@masayume/markets/react";
import { QUOTE_STALE_AFTER_MS } from "@masayume/core/constants";
import { Clock } from "lucide-react";
import { useEffect, useRef } from "react";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { useChainNowMs } from "@/features/markets";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { deriveBlocker, usePlaceBet } from "@/features/markets/ticket";
import { OutcomeNote } from "@/features/markets/ticket/OutcomeNote";
import { useFundingCheck } from "@/features/markets/ticket/useFunding";
import { useTicketRoute } from "@/features/session";
import { useWalletSession } from "@/lib/wallet-session";
import { clockUrgency } from "../stage/StageFace";
import { LUCKY } from "./copy";
import { multipleAt } from "./format";
import type { DealtLuckyWire, LuckyDealWire, LuckyPlacedStatus } from "./lucky-wire";
import { useLuckyCheck } from "./useLuckyCheck";

export interface LuckyDealProps {
  deal: DealtLuckyWire;
  symbol: string;
  onReport: (status: LuckyPlacedStatus, txHash: Hex | null, booked: BookedOrder | null) => void;
  onSkip: () => void;
  skipping: boolean;
}

/**
 * The deal card: everything doc 06 says must be on screen before the signature — the commitment and both
 * seeds with a check run in this browser, the Window and its clock, the side, the LIVE quote and what it
 * buys, the slippage cap, who pays the gas — and one tap, through the Ticket lane and nothing else.
 *
 * The quote the card places on is the browser's live one, never the server's snapshot: the snapshot is
 * what the reel dealt, the live one is what the book will take, and when the two have parted the card
 * says so. The tap itself is `usePlaceBet` → `submitOrder`, the same lane as every Ticket, which re-quotes
 * against the cap the player saw and comes back as a requote rather than a surprise.
 */
export function LuckyDeal({ deal, symbol, onReport, onSkip, skipping }: LuckyDealProps) {
  const marketReading = useMarket(toMarketId(deal.window.marketId));
  const market = marketReading && isOk(marketReading) ? marketReading.value : null;
  if (!market) {
    return (
      <section className="lk-deal" aria-label={LUCKY.deal.title}>
        <h2 className="lk-deal-title">{LUCKY.deal.title}</h2>
        <Proof deal={deal} />
        <p className="lk-caption">{LUCKY.deal.quote.getting}</p>
      </section>
    );
  }
  return <DealCard deal={deal} market={market} symbol={symbol} onReport={onReport} onSkip={onSkip} skipping={skipping} />;
}

function Proof({ deal }: { deal: LuckyDealWire }) {
  const check = useLuckyCheck(deal);
  const words = LUCKY.deal.proof;
  const line = check === "checking" ? words.checking : check === "verified" ? words.verified : check === "mismatch" ? words.mismatch : words.unavailable;
  return (
    <div className="st-band lk-section">
      <span className="lk-section-k">{words.label}</span>
      <div className="lk-kv">
        <span className="lk-kv-k">{words.commitment}</span>
        <span className="lk-hex">{deal.commitment}</span>
        <span className="lk-kv-k">{words.serverSeed}</span>
        <span className="lk-hex">{deal.serverSeed}</span>
        <span className="lk-kv-k">{words.clientSeed}</span>
        <span className="lk-hex">{deal.clientSeed}</span>
      </div>
      <p className="lk-meta">
        {words.nonce(deal.nonce, deal.policyVersion)} · {words.candidates(deal.candidateCount)}
      </p>
      <p className="lk-check" data-state={check} role="status">
        <span className="lk-check-dot" aria-hidden />
        <span>{line}</span>
      </p>
      <p className="lk-meta">{words.scope}</p>
    </div>
  );
}

function DealCard({ deal, market, symbol, onReport, onSkip, skipping }: LuckyDealProps & { market: EventMarket }) {
  const { window: win, draw } = deal;
  const side = draw.side;
  const stakeBase = BigInt(deal.stakeBase);
  const decimals = market.decimals;
  const session = useWalletSession();
  const { address, hasSigner } = useSigner();
  const nowMs = useChainNowMs();
  const opening = useOpeningPrice(market.marketId);
  const onchain = useOnchain(market.marketId);
  const phase =
    nowMs > 0
      ? phaseOf({ ...market, openingPriceRaw: opening?.ok ? opening.value : market.openingPriceRaw, onchainStatus: onchain?.ok ? onchain.value.status : null }, nowMs)
      : null;

  // The live quote, off the live book, at the dealt stake on the dealt side — this is `displayedQuote`.
  const reading = useStakeQuote({
    target: { marketId: market.marketId, poolAddress: market.poolAddress, decimals, intervalSec: market.intervalSec },
    side,
    stakeBase,
    enabled: hasSigner && phase === "trading",
  });
  const quote = reading?.ok ? reading.value : null;
  const aged = quote !== null && nowMs > 0 && nowMs - quote.quotedAtMs > QUOTE_STALE_AFTER_MS;
  const stale = Boolean(reading?.ok && (reading.stale || aged));

  const sheet = useBalanceSheet(address);
  const balances = sheet?.ok ? sheet.value : null;
  const walletAvailableBase = balances ? balances.spendableBase + balances.venueCreditBase : null;
  const routing = useTicketRoute({ market, side, stakeBase, quote, onchain: onchain?.ok ? onchain.value : null, source: "wallet", walletAvailableBase, symbol });
  const bet = usePlaceBet({ submitter: routing.submitter, wallet: routing.wallet });
  const displayed = bet.requoted ?? quote;
  const walletRoute = routing.route.kind === "wallet";
  const funding = useFundingCheck(walletRoute ? address : null, onchain?.ok ? onchain.value : null, displayed);

  const blocker = deriveBlocker({
    session,
    hasSigner,
    phase,
    placing: bet.placing,
    side,
    availableBase: routing.availableBase,
    stakeBase,
    decimals,
    quote: reading,
    quoting: reading === null,
    quoteStale: stale,
    funding: walletRoute ? funding : null,
  });
  const ctx: BlockerContext = {
    cadence: formatCadence(market.intervalSec),
    minStakeText: `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`,
    spendableText: routing.availableBase !== null ? `${formatBaseUnits(routing.availableBase, decimals)} ${symbol}` : undefined,
    quotedCents: displayed?.oddsCents,
    fillableStakeText: displayed?.partial ? `${formatBaseUnits(displayed.fillableStakeBase, decimals)} ${symbol}` : undefined,
  };

  // The lane's answer, reported once. A requote is not an answer: the card shows the new cap and waits for the next tap.
  const reportedRef = useRef(false);
  useEffect(() => {
    const outcome = bet.state.outcome;
    if (!outcome || reportedRef.current || outcome.status === "requote") return;
    reportedRef.current = true;
    if (outcome.status === "confirmed") onReport("confirmed", outcome.booked.txHash, outcome.booked);
    else if (outcome.status === "nothingFilled") onReport("nothingFilled", outcome.txHash, null);
    else if (outcome.status === "reverted") onReport("reverted", outcome.txHash, null);
    else if (outcome.status === "refused") onReport("refused", null, null);
    else onReport("unknown", outcome.txHash ?? null, null);
  }, [bet.state.outcome, onReport]);

  const remainingSec = win.expirySec - Math.floor((nowMs || Date.now()) / 1_000);
  const urgency = clockUrgency(remainingSec);
  const gone = phase !== null && phase !== "trading" && phase !== "pendingOpeningPrint" && phase !== "upcoming";
  const dealtMultiple = multipleAt(deal.quote.avgPriceBps);
  const liveMultiple = displayed ? multipleAt(displayed.avgPriceBps) : null;
  const drifted = displayed !== null && luckyDrifted(deal.quote.avgPriceBps, displayed.avgPriceBps);
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const words = LUCKY.deal;

  const place = () => {
    if (!displayed) return;
    void bet.place({ market, side, stakeBase, displayedQuote: displayed, route: routing.route });
  };

  return (
    <section className="lk-deal" aria-label={words.title}>
      <h2 className="lk-deal-title">{words.title}</h2>
      <p className="lk-honesty">{words.honesty}</p>

      <Proof deal={deal} />

      <div className="st-band lk-section">
        <span className="lk-section-k">{words.window.label}</span>
        <div className="lk-window-head">
          <span className="lk-window-pair">
            <AssetDisc asset={win.asset} className="lk-asset-disc" />
            {words.window.pair(win.asset)}
          </span>
          <span className="st-cadence">{formatCadence(win.intervalSec)}</span>
          <span className="lk-window-side" data-side={side}>
            {SIDE_WORD[side]}
          </span>
        </div>
        <p className="st-clock" role="timer" data-urgency={urgency.level} data-pulse={urgency.pulse || undefined}>
          <Clock aria-hidden />
          {remainingSec <= 0 ? words.window.settling : words.window.settlesIn(formatClock(remainingSec))}
        </p>
        <div className="lk-window-odds">
          <span>{words.window.dealtAt(dealtMultiple, bpsToOddsCents(deal.quote.avgPriceBps))}</span>
          {deal.otherSideBps !== null && <span>{words.window.otherSide(SIDE_WORD[side === "up" ? "down" : "up"], bpsToOddsCents(deal.otherSideBps))}</span>}
        </div>
        {gone && <p className="st-hint st-hint--locked">{words.window.gone}</p>}
      </div>

      <div className="st-band lk-section">
        <span className="lk-section-k">{words.quote.label}</span>
        <div className="lk-cells">
          <Cell k={words.quote.price} v={displayed ? `${displayed.oddsCents}¢` : null} tone="live" />
          <Cell k={words.quote.pays} v={liveMultiple} tone="live" />
          <Cell k={words.quote.contracts} v={displayed ? formatBaseUnits(displayed.contractsRaw, decimals, { minDp: 0, maxDp: 2 }) : null} />
          <Cell k={words.quote.cost} v={displayed ? money(displayed.expectedCostBase) : null} />
          <Cell k={words.quote.slippage} v={displayed ? money(displayed.maxCostBase - displayed.expectedCostBase) : null} />
          <Cell k={words.quote.payout} v={displayed ? money(displayed.payoutIfRightBase) : null} />
        </div>
        <p className={`lk-caption${displayed && !stale ? " lk-caption--live" : ""}`}>
          {displayed ? (stale ? words.quote.requoting : reading?.ok && reading.staleReason === "offline" ? words.quote.offline : words.quote.live) : reading && reading.ok && reading.value === null ? words.quote.none : words.quote.getting}
        </p>
        {drifted && liveMultiple && <p className="lk-drift">{words.quote.drift(dealtMultiple, liveMultiple)}</p>}
      </div>

      <div className="st-band lk-section">
        <span className="lk-section-k">{words.gas.label}</span>
        <p className="lk-caption">{routing.armed ? words.gas.key : routing.fallbackReason ? words.gas.fallback(routing.fallbackReason) : words.gas.wallet}</p>
      </div>

      <OutcomeNote state={bet.state} decimals={decimals} symbol={symbol} onDismiss={bet.reset} />

      <div className="lk-actions">
        <BlockedButton blocker={blocker} ctx={ctx} tone={side} size="lg" className="w-full" onClick={place}>
          {words.place(SIDE_WORD[side])} {displayed && <Money value={displayed.maxCostBase} decimals={decimals} symbol={symbol} />}
        </BlockedButton>
        <button type="button" className="lk-quiet" onClick={onSkip} disabled={skipping || bet.placing}>
          {skipping ? words.skipping : words.skip}
        </button>
      </div>
    </section>
  );
}

function Cell({ k, v, tone }: { k: string; v: string | null; tone?: "live" }) {
  return (
    <div className="st-band lk-cell">
      <span className="lk-cell-k">{k}</span>
      <span className="lk-cell-v" data-tone={v === null ? "pending" : tone}>
        {v ?? "—"}
      </span>
    </div>
  );
}
