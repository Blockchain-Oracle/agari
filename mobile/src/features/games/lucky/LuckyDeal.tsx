import { blockerLabel, formatCadence, type BlockerContext } from "@agari/core/copy";
import { QUOTE_STALE_AFTER_MS } from "@agari/core/constants";
import { luckyDrifted } from "@agari/core/games";
import { phase as phaseOf } from "@agari/core/lifecycle";
import type { BookedOrder } from "@agari/core/ports";
import { isOk } from "@agari/core/schemas";
import { minStakeBase } from "@agari/core/sizing";
import { toMarketId, type EventMarket, type Signature } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits, formatClock } from "@agari/core/units";
import { useBalanceSheet, useMarket, useOnchain, useOpeningPrice, useSigner, useStakeQuote } from "@agari/markets/react";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import { multipleAt } from "@/features/games/lucky/format";
import type { DealtLuckyWire, LuckyPlacedStatus } from "@/features/games/lucky/lucky-wire";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { deriveBlocker } from "@/features/markets/ticket/ticket-guards";
import { useFundingCheck } from "@/features/markets/ticket/useFunding";
import { usePlaceBet } from "@/features/markets/ticket/usePlaceBet";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useTicketRoute } from "@/features/session/useTicketRoute";
import { TICKET } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Card, LoadingState, Pill, SignReview, type QuoteLine, type SignPhase } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TYPE, useTheme } from "~/theme";
import { LuckyProof } from "./LuckyProof";

interface Props {
  deal: DealtLuckyWire;
  symbol: string;
  onReport: (status: LuckyPlacedStatus, txHash: Signature | null, booked: BookedOrder | null) => void;
  onSkip: () => void;
  skipping: boolean;
}

/**
 * web's `LuckyDeal.tsx`: everything that must be on screen before the signature — the proof and its check, the
 * Window and its clock, the side, the LIVE quote and what it buys, the slippage cap, who pays the network fee — then
 * the kit's SignReview and a slide. The order goes through `usePlaceBet` → `submitOrder`, the same lane as every
 * Ticket, which re-quotes against the cap the player saw and comes back as a requote rather than a surprise.
 */
export function LuckyDeal(props: Props) {
  const { color } = useTheme();
  const reading = useMarket(toMarketId(props.deal.window.marketId));
  const market = reading && isOk(reading) ? reading.value : null;
  if (!market) {
    return (
      <Card>
        <Text style={[TYPE.title, { color: color.ink }]}>{LUCKY.deal.title}</Text>
        <LuckyProof deal={props.deal} />
        <LoadingState shape="plate" label={LUCKY.deal.quote.getting} />
      </Card>
    );
  }
  return <DealCard {...props} market={market} />;
}

/** web's StageFace clock urgency: calm, near (ten minutes), last (two). */
function urgencyInk(remainingSec: number, color: ReturnType<typeof useTheme>["color"]): string {
  if (remainingSec <= 120) return color.accent;
  if (remainingSec <= 600) return color.warning;
  return color.inkSecondary;
}

function DealCard({ deal, market, symbol, onReport, onSkip, skipping }: Props & { market: EventMarket }) {
  const { color } = useTheme();
  const { window: win, draw } = deal;
  const side = draw.side;
  const stakeBase = BigInt(deal.stakeBase);
  const decimals = market.decimals;
  const session = useWalletSession();
  const { address, hasSigner } = useSigner();
  const nowMs = useChainNowMs();
  const opening = useOpeningPrice(market.marketId);
  const onchain = useOnchain(market.marketId);
  const openingPriceRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const onchainStatus = onchain?.ok ? onchain.value.status : null;
  const phase = nowMs > 0 ? phaseOf({ ...market, openingPriceRaw, onchainStatus }, nowMs) : null;

  // The live quote, off the live book, at the dealt stake on the dealt side.
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
  const onchainValue = onchain?.ok ? onchain.value : null;
  const routing = useTicketRoute({ market, side, stakeBase, quote, onchain: onchainValue, source: "wallet", walletAvailableBase, symbol });
  const bet = usePlaceBet({ submitter: routing.submitter, wallet: routing.wallet });
  const requoted = bet.requoteFor(market.marketId, side, stakeBase);
  const displayed = requoted ?? quote;
  const walletRoute = routing.route.kind === "wallet";
  const funding = useFundingCheck(walletRoute ? address : null, onchainValue, displayed);

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

  // The lane's answer, reported once. A requote is not an answer: the card shows the new cap and waits for the next slide.
  const reportedRef = useRef(false);
  useEffect(() => {
    const outcome = bet.state.outcome;
    if (!outcome || reportedRef.current || outcome.status === "requote") return;
    reportedRef.current = true;
    if (outcome.status === "confirmed") onReport("confirmed", outcome.booked.txHash, outcome.booked);
    else if (outcome.status === "nothingFilled") onReport("nothingFilled", outcome.txHash, null);
    else if (outcome.status === "reverted") onReport("reverted", outcome.txHash, null);
    else if (outcome.status === "refused") onReport("refused", null, null);
    else onReport("unknown", outcome.status === "resting" ? outcome.rested.txHash : (outcome.txHash ?? null), null);
  }, [bet.state.outcome, onReport]);

  const remainingSec = win.expirySec - Math.floor((nowMs || Date.now()) / 1_000);
  const gone = phase !== null && phase !== "trading" && phase !== "pendingOpeningPrint" && phase !== "upcoming";
  const dealtMultiple = multipleAt(deal.quote.avgPriceBps);
  const liveMultiple = displayed ? multipleAt(displayed.avgPriceBps) : null;
  const drifted = displayed !== null && luckyDrifted(deal.quote.avgPriceBps, displayed.avgPriceBps);
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const words = LUCKY.deal;
  const quoteCaption = displayed
    ? stale
      ? words.quote.requoting
      : reading?.ok && reading.staleReason === "offline"
        ? words.quote.offline
        : words.quote.live
    : reading && reading.ok && reading.value === null
      ? words.quote.none
      : words.quote.getting;

  const lines: QuoteLine[] = displayed
    ? [
        { label: words.quote.price, value: `${displayed.oddsCents}¢`, tone: "accent" },
        { label: words.quote.pays, value: liveMultiple ?? "—", tone: "accent" },
        { label: words.quote.contracts, value: formatBaseUnits(displayed.contractsRaw, decimals, { minDp: 0, maxDp: 2 }) },
        { label: words.quote.cost, value: money(displayed.expectedCostBase) },
        { label: words.quote.slippage, value: money(displayed.maxCostBase - displayed.expectedCostBase) },
        { label: words.quote.payout, value: money(displayed.payoutIfRightBase), tone: "profit" },
      ]
    : [];
  // Once the lane has answered (anything but a requote) the order is out: the slide stays shut while the answer is recorded.
  const answered = bet.state.outcome !== null && bet.state.outcome.status !== "requote";
  const sending = bet.state.phase === "submitted" || bet.state.phase === "confirming";
  const signPhase: SignPhase = bet.state.phase === "submitted" ? "signing" : bet.state.phase === "confirming" ? "sending" : answered ? "done" : "review";
  const place = () => {
    if (!displayed) return;
    void bet.place({ market, side, stakeBase, displayedQuote: displayed, route: routing.route });
  };

  return (
    <Card>
      <Text style={[TYPE.title, { color: color.ink }]} accessibilityRole="header">
        {words.title}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.honesty}</Text>
      <LuckyProof deal={deal} />

      <View style={[styles.band, { borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.window.label}</Text>
        <View style={styles.windowHead}>
          <AssetDisc asset={win.asset} size={30} />
          <Text style={[TYPE.bodyStrong, styles.pair, { color: color.ink }]}>{words.window.pair(win.asset)}</Text>
          <Pill label={formatCadence(win.intervalSec)} />
          <Pill label={SIDE_WORD[side]} tone={side === "up" ? "profit" : "loss"} />
        </View>
        <Text style={[TYPE.data, { color: urgencyInk(remainingSec, color) }]} accessibilityRole="timer">
          {remainingSec <= 0 ? words.window.settling : words.window.settlesIn(formatClock(remainingSec))}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {words.window.dealtAt(dealtMultiple, bpsToOddsCents(deal.quote.avgPriceBps))}
          {deal.otherSideBps !== null ? ` · ${words.window.otherSide(SIDE_WORD[side === "up" ? "down" : "up"], bpsToOddsCents(deal.otherSideBps))}` : ""}
        </Text>
        {gone ? <Text style={[TYPE.caption, { color: color.loss }]}>{words.window.gone}</Text> : null}
      </View>

      <View style={[styles.band, { borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.quote.label}</Text>
        <Text style={[TYPE.caption, { color: displayed && !stale ? color.profit : color.inkMuted }]}>{quoteCaption}</Text>
        {drifted && liveMultiple ? <Text style={[TYPE.caption, { color: color.warning }]}>{words.quote.drift(dealtMultiple, liveMultiple)}</Text> : null}
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.gas.label}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {routing.armed ? words.gas.key : routing.fallbackReason ? words.gas.fallback(routing.fallbackReason) : words.gas.wallet}
        </Text>
      </View>

      {requoted ? (
        <Text style={[TYPE.caption, { color: color.warning }]} accessibilityLiveRegion="polite">
          {TICKET.requotePrefix} {money(requoted.maxCostBase)} {TICKET.requoteSuffix}
        </Text>
      ) : null}

      <SignReview
        title={`${words.place(SIDE_WORD[side])} ${win.asset} ${formatCadence(win.intervalSec)}`}
        lines={lines}
        maxLoss={displayed ? money(displayed.maxCostBase) : "—"}
        confirmLabel={`Slide to place ${SIDE_WORD[side]}`}
        onConfirm={place}
        phase={signPhase}
        blocker={sending || answered ? null : blocker ? blockerLabel(blocker, ctx) : null}
        tone={side === "up" ? "profit" : "loss"}
      />
      {answered ? <Text style={[TYPE.caption, { color: color.inkMuted }]} accessibilityLiveRegion="polite">{words.skipping}</Text> : null}
      <Button label={skipping ? words.skipping : words.skip} variant="ghost" size="sm" onPress={onSkip} disabled={skipping || sending || answered} />
    </Card>
  );
}

const styles = StyleSheet.create({
  band: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  windowHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  pair: { flexShrink: 1 },
});
