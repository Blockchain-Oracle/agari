import { formatCadence, verdictStrings } from "@agari/core/copy";
import { OUTCOME_TO_SIDE, type ClaimLeg, type EventMarket, type Resolution, type Verdict } from "@agari/core/types";
import { formatBaseUnits, secToMs, shortHex } from "@agari/core/units";
import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { printSourceText } from "@/features/markets/verdict/print-source";
import { buildTradeTweetText, type TradeCard } from "@/features/share/trade-card";
import { MARKETS, VERDICT_UI } from "@/lib/copy";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { oraclePriceText } from "../parts/format";
import { ClaimWinnings } from "./ClaimWinnings";
import { Receipt, ReceiptRow } from "./Receipt";
import { ShareLink } from "./ShareLink";
import { VerdictStamp } from "./VerdictStamp";

/** A settled round from the fill projection carries its asset as plain text, so a verdict takes any asset name. */
type VerdictMarket = Pick<EventMarket, "marketId" | "intervalSec" | "expirySec" | "openingPriceRaw"> & { asset: string };

interface Props {
  verdict: Verdict;
  market: VerdictMarket;
  /** null while the settlement record is still landing; the receipt then shows its proof rows as pending. */
  resolution: Resolution | null;
  symbol: string;
}

const SIDE_WORD = { up: MARKETS.up, down: MARKETS.down } as const;

/**
 * web's VerdictCard: the pressed stamp beside the net P&L, every leg the wallet held, the claim, the cream settlement
 * receipt to audit it, and the "Share card ↗" link — in the market card's frame (12 radius, hairline, surface 1).
 */
export function VerdictCard({ verdict, market, resolution, symbol }: Props) {
  const { color } = useTheme();
  const strings = verdictStrings(verdict.outcome);
  const settledAtMs = verdict.settledAtMs ?? resolution?.settledAtMs ?? secToMs(market.expirySec);
  const settlementTx = resolution?.settlementTxHash ?? null;
  const source = printSourceText(resolution, market.expirySec, market.asset);
  const sides = verdict.legs.map((leg) => SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]).join(" + ");
  const paper = useRef<View>(null);

  return (
    <View style={[styles.card, { borderColor: color.hairline, backgroundColor: color.surface1 }]} accessibilityLabel={`${VERDICT_UI.title}: ${strings.line}`}>
      <View style={styles.header}>
        <VerdictStamp outcome={verdict.outcome} />
        <PnlFigure verdict={verdict} symbol={symbol} />
      </View>
      {verdict.outcome === "void" ? <Text style={[styles.body, { color: color.inkSecondary }]}>{strings.line}</Text> : null}
      <VerdictLegs legs={verdict.legs} decimals={verdict.decimals} symbol={symbol} />
      <ClaimWinnings verdict={verdict} marketId={market.marketId} symbol={symbol} />
      <View ref={paper} collapsable={false}>
        <Receipt
          figure={
            <Text style={[styles.hero, { color: color.creamInk }]}>
              {formatBaseUnits(verdict.payoutBase, verdict.decimals)}
              <Text style={{ color: color.inkSecondary }}> {symbol}</Text>
            </Text>
          }
          figureLabel={VERDICT_UI.paidOut}
          settledAtMs={settledAtMs}
          stamp={<VerdictStamp outcome={verdict.outcome} size="compact" />}
        >
          <ReceiptRow label={VERDICT_UI.window} value={`${market.asset} · ${formatCadence(market.intervalSec)} · ${sides}`} />
          <ReceiptRow label={VERDICT_UI.openingPrint} value={oraclePriceText(resolution?.openingRaw ?? market.openingPriceRaw, market.asset)} />
          <ReceiptRow label={VERDICT_UI.closingPrint} value={oraclePriceText(resolution?.closingRaw ?? null, market.asset)} />
          <ReceiptRow
            label={VERDICT_UI.settlementTx}
            value={settlementTx ? shortHex(settlementTx, 10, 4) : "—"}
            onPress={settlementTx ? () => void openExternal(explorerUrl("tx", settlementTx)) : null}
            degradedLabel={VERDICT_UI.pendingTx}
          />
          <ReceiptRow
            label={VERDICT_UI.oracleGraph}
            value={source ? VERDICT_UI.question(source) : "—"}
            onPress={null}
            degradedLabel={VERDICT_UI.noQuestion}
          />
        </Receipt>
      </View>
      <View style={styles.share}>
        <ShareLink card={paper} text={buildTradeTweetText(toTradeCard(verdict, market, resolution, symbol, settledAtMs))} />
      </View>
    </View>
  );
}

/** web's PnlFigure: the one figure allowed profit/loss ink; without an entry cost on record it reads as a payout. */
function PnlFigure({ verdict, symbol }: { verdict: Verdict; symbol: string }) {
  const { color } = useTheme();
  const costKnown = verdict.costBasisBase !== null;
  const ink = verdict.pnlBase > 0n ? color.profit : verdict.pnlBase < 0n ? color.loss : color.inkSecondary;
  return (
    <View style={styles.pnl}>
      <Text style={[styles.micro, { color: color.inkMuted }]}>{costKnown ? VERDICT_UI.netPnl : VERDICT_UI.paidOut}</Text>
      <Text style={[styles.hero, styles.right, { color: ink }]}>
        {formatBaseUnits(verdict.pnlBase, verdict.decimals, { signed: true })}
        <Text style={{ color: color.inkSecondary }}> {symbol}</Text>
      </Text>
      {costKnown ? null : <Text style={[styles.caption, { color: color.inkMuted }]}>{VERDICT_UI.costUnknown}</Text>}
    </View>
  );
}

/** web's VerdictLegs: every side the wallet held, in words — a losing leg is listed at payout 0 rather than hidden. */
function VerdictLegs({ legs, decimals, symbol }: { legs: readonly ClaimLeg[]; decimals: number; symbol: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.legs} accessibilityLabel={VERDICT_UI.legs}>
      {legs.map((leg) => (
        <View key={leg.outcomeIdx} style={[styles.leg, { borderBottomColor: color.hairline }]}>
          <Text style={[styles.data, { color: color.inkSecondary }]}>
            <Text style={[styles.strong, { color: color.ink }]}>{SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]}</Text>
            {"  "}
            {formatBaseUnits(leg.amountRaw, decimals)} {VERDICT_UI.contracts}
          </Text>
          <Text style={[styles.data, { color: color.inkSecondary }]}>
            {VERDICT_UI.payout} <Text style={{ color: color.ink }}>{formatBaseUnits(leg.payoutBase, decimals)}</Text> {symbol}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** web's toTradeCard: every field the verdict, the Window and the settlement record already hold. */
function toTradeCard(verdict: Verdict, market: VerdictMarket, resolution: Resolution | null, symbol: string, settledAtMs: number): TradeCard {
  return {
    asset: market.asset,
    intervalSec: market.intervalSec,
    sides: verdict.legs.map((leg) => OUTCOME_TO_SIDE[leg.outcomeIdx]),
    outcome: verdict.outcome,
    lineRaw: resolution?.openingRaw ?? market.openingPriceRaw,
    closeRaw: resolution?.closingRaw ?? null,
    stakeBase: verdict.costBasisBase,
    payoutBase: verdict.payoutBase,
    pnlBase: verdict.pnlBase,
    decimals: verdict.decimals,
    symbol,
    expirySec: market.expirySec,
    settledAtMs,
    entryTxHash: null,
    settlementTxHash: resolution?.settlementTxHash ?? null,
    printSource: resolution?.printSource ?? null,
    singleSource: resolution?.singleSource ?? false,
    voidReason: resolution?.voidReason ?? null,
  };
}

const styles = StyleSheet.create({
  card: { gap: 20, borderWidth: 1, borderRadius: 12, padding: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  pnl: { flexShrink: 1, alignItems: "flex-end", gap: 4 },
  micro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  // type-data-hero at 402 px: clamp(28, 9vw, 40) → 36; the data face does not resolve there, so it is Inter 600.
  hero: { fontFamily: FONT.bodyStrong, fontSize: 36, lineHeight: 38, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  right: { textAlign: "right" },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  legs: { gap: 8 },
  leg: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, paddingBottom: 8 },
  data: { flexShrink: 1, fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18.2, fontVariant: ["tabular-nums"] },
  strong: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23.25 },
  share: { flexDirection: "row", justifyContent: "flex-end" },
});
