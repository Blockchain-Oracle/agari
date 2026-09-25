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
import { Clock } from "lucide-react-native";
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
import { useWalletSession } from "@/lib/wallet-session";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { OutcomeNote } from "~/features/markets/ticket/OutcomeNote";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { LuckyProof } from "./LuckyProof";
import { PlaceButton, QuoteCell } from "./DealParts";
import { Band, Cadence, clockInk, LinkWord, LUCKY_TEXT, SectionK, useLuckyTokens } from "./parts";

interface Props {
  deal: DealtLuckyWire;
  symbol: string;
  onReport: (status: LuckyPlacedStatus, txHash: Signature | null, booked: BookedOrder | null) => void;
  onSkip: () => void;
  skipping: boolean;
}

/**
 * web's `LuckyDeal.tsx` (`.lk-deal`): everything that must be on screen before the signature — the honesty line,
 * the proof and its check, the Window and its clock, the side, the LIVE quote and what it buys, the slippage cap,
 * who pays the network fee — and one tap, through `usePlaceBet` → `submitOrder`, the lane every Ticket uses.
 */
export function LuckyDeal(props: Props) {
  const { color } = useLuckyTokens();
  const reading = useMarket(toMarketId(props.deal.window.marketId));
  const market = reading && isOk(reading) ? reading.value : null;
  if (!market) {
    return (
      <View style={[styles.deal, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={LUCKY.deal.title}>
        <Text style={[LUCKY_TEXT.pixelTitle, { color: color.ink }]}>{LUCKY.deal.title.toUpperCase()}</Text>
        <LuckyProof deal={props.deal} />
        <Text style={[LUCKY_TEXT.caption, { color: color.inkSecondary }]}>{LUCKY.deal.quote.getting}</Text>
      </View>
    );
  }
  return <DealCard {...props} market={market} />;
}

function DealCard({ deal, market, symbol, onReport, onSkip, skipping }: Props & { market: EventMarket }) {
  const { lk, color } = useLuckyTokens();
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
    nowMs > 0 ? phaseOf({ ...market, openingPriceRaw: opening?.ok ? opening.value : market.openingPriceRaw, onchainStatus: onchain?.ok ? onchain.value.status : null }, nowMs) : null;

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
  const displayed = bet.requoteFor(market.marketId, side, stakeBase) ?? quote;
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
    else onReport("unknown", outcome.status === "resting" ? outcome.rested.txHash : (outcome.txHash ?? null), null);
  }, [bet.state.outcome, onReport]);

  const remainingSec = win.expirySec - Math.floor((nowMs || Date.now()) / 1_000);
  const clock = clockInk(remainingSec, color);
  const gone = phase !== null && phase !== "trading" && phase !== "pendingOpeningPrint" && phase !== "upcoming";
  const dealtMultiple = multipleAt(deal.quote.avgPriceBps);
  const liveMultiple = displayed ? multipleAt(displayed.avgPriceBps) : null;
  const drifted = displayed !== null && luckyDrifted(deal.quote.avgPriceBps, displayed.avgPriceBps);
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const words = LUCKY.deal;
  const caption = displayed
    ? stale
      ? words.quote.requoting
      : reading?.ok && reading.staleReason === "offline"
        ? words.quote.offline
        : words.quote.live
    : reading && reading.ok && reading.value === null
      ? words.quote.none
      : words.quote.getting;
  const place = () => {
    if (!displayed) return;
    void bet.place({ market, side, stakeBase, displayedQuote: displayed, route: routing.route });
  };

  return (
    <View style={[styles.deal, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={words.title}>
      <Text style={[LUCKY_TEXT.pixelTitle, { color: color.ink }]} accessibilityRole="header">
        {words.title.toUpperCase()}
      </Text>
      <Text style={[styles.honesty, { color: color.inkSecondary }]}>{words.honesty}</Text>

      <LuckyProof deal={deal} />

      <Band>
        <SectionK>{words.window.label}</SectionK>
        <View style={styles.windowHead}>
          <View style={styles.pair}>
            <AssetDisc asset={win.asset} size={16} />
            <Text style={[styles.pixel16, { color: color.accent }]}>{words.window.pair(win.asset).toUpperCase()}</Text>
          </View>
          <Cadence label={formatCadence(win.intervalSec)} />
          <Text style={[styles.pixel16, { color: side === "up" ? color.profit : color.loss }]}>{SIDE_WORD[side].toUpperCase()}</Text>
        </View>
        <View style={styles.clock} accessibilityRole="timer">
          <Clock size={13} color={clock} strokeWidth={2} />
          <Text style={[styles.clockText, { color: clock }]}>{(remainingSec <= 0 ? words.window.settling : words.window.settlesIn(formatClock(remainingSec))).toUpperCase()}</Text>
        </View>
        <View style={styles.odds}>
          <Text style={[LUCKY_TEXT.meta, { color: color.inkMuted }]}>{words.window.dealtAt(dealtMultiple, bpsToOddsCents(deal.quote.avgPriceBps))}</Text>
          {deal.otherSideBps !== null ? (
            <Text style={[LUCKY_TEXT.meta, { color: color.inkMuted }]}>{words.window.otherSide(SIDE_WORD[side === "up" ? "down" : "up"], bpsToOddsCents(deal.otherSideBps))}</Text>
          ) : null}
        </View>
        {gone ? <Text style={[LUCKY_TEXT.caption, styles.center, { color: color.accent }]}>{words.window.gone}</Text> : null}
      </Band>

      <Band>
        <SectionK>{words.quote.label}</SectionK>
        <View style={styles.cells}>
          <QuoteCell k={words.quote.price} v={displayed ? `${displayed.oddsCents}¢` : null} live />
          <QuoteCell k={words.quote.pays} v={liveMultiple} live />
          <QuoteCell k={words.quote.contracts} v={displayed ? formatBaseUnits(displayed.contractsRaw, decimals, { minDp: 0, maxDp: 2 }) : null} />
          <QuoteCell k={words.quote.cost} v={displayed ? money(displayed.expectedCostBase) : null} />
          <QuoteCell k={words.quote.slippage} v={displayed ? money(displayed.maxCostBase - displayed.expectedCostBase) : null} />
          <QuoteCell k={words.quote.payout} v={displayed ? money(displayed.payoutIfRightBase) : null} />
        </View>
        <Text style={[LUCKY_TEXT.caption, { color: displayed && !stale ? color.profit : color.inkSecondary }]}>{caption}</Text>
        {drifted && liveMultiple ? (
          <Text style={[styles.drift, { borderColor: lk.driftBorder, backgroundColor: lk.driftBg, color: color.inkSecondary }]}>{words.quote.drift(dealtMultiple, liveMultiple)}</Text>
        ) : null}
      </Band>

      <Band>
        <SectionK>{words.gas.label}</SectionK>
        <Text style={[LUCKY_TEXT.caption, { color: color.inkSecondary }]}>
          {routing.armed ? words.gas.key : routing.fallbackReason ? words.gas.fallback(routing.fallbackReason) : words.gas.wallet}
        </Text>
      </Band>

      <OutcomeNote state={bet.state} decimals={decimals} symbol={symbol} onDismiss={bet.reset} />

      <View style={styles.actions}>
        <PlaceButton
          blocked={blocker ? blockerLabel(blocker, ctx) : null}
          side={side}
          label={words.place(SIDE_WORD[side])}
          money={displayed ? money(displayed.maxCostBase) : null}
          symbol={symbol}
          onPress={place}
        />
        <LinkWord label={skipping ? words.skipping : words.skip} onPress={onSkip} disabled={skipping || bet.placing} style={[styles.quiet, { color: color.inkSecondary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deal: { gap: 10, borderRadius: 20, padding: 16, borderWidth: 1 },
  honesty: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  windowHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  pair: { flexDirection: "row", alignItems: "center", gap: 6 },
  pixel16: { fontFamily: PIXEL_FONT, fontSize: 16, lineHeight: 20, letterSpacing: 2.88 },
  clock: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  clockText: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 18, letterSpacing: 2.8, fontVariant: ["tabular-nums"] },
  odds: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 },
  center: { textAlign: "center" },
  cells: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  drift: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, fontFamily: FONT.body, fontSize: 12, lineHeight: 18.6 },
  actions: { gap: 8 },
  quiet: { alignSelf: "flex-start" },
});
