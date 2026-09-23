import { formatCadence } from "@agari/core/copy";
import { OUTCOME_TO_SIDE, type EventMarket, type Resolution, type Verdict } from "@agari/core/types";
import { formatBaseUnits, secToMs, shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { oraclePriceText } from "../parts/format";
import { printSourceText } from "@/features/markets/verdict/print-source";
import { buildTradeTweetText, type TradeCard } from "@/features/share/trade-card";
import { MARKETS, VERDICT_UI } from "@/lib/copy";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { ShareButton } from "../share/ShareButton";
import { ClaimWinnings } from "./ClaimWinnings";
import { VerdictStamp } from "./VerdictStamp";

type VerdictMarket = Pick<EventMarket, "marketId" | "intervalSec" | "expirySec" | "openingPriceRaw"> & { asset: string };

const SIDE_WORD = { up: MARKETS.up, down: MARKETS.down } as const;

interface Props {
  verdict: Verdict;
  market: VerdictMarket;
  resolution: Resolution | null;
  symbol: string;
}

/**
 * web's VerdictCard: the pressed stamp (上がり vermilion, 放銃 a fact, 無効 with its reason) beside the net P&L, every
 * leg the wallet held, the claim, and the cream settlement receipt to audit it — then the share.
 */
export function VerdictCard({ verdict, market, resolution, symbol }: Props) {
  const { color } = useTheme();
  const settledAtMs = verdict.settledAtMs ?? resolution?.settledAtMs ?? secToMs(market.expirySec);
  const settlementTx = resolution?.settlementTxHash ?? null;
  const source = printSourceText(resolution, market.expirySec, market.asset);
  const costKnown = verdict.costBasisBase !== null;
  const pnlInk = verdict.pnlBase > 0n ? color.profit : verdict.pnlBase < 0n ? color.loss : color.ink;
  const sides = verdict.legs.map((leg) => SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]).join(" + ");

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <VerdictStamp outcome={verdict.outcome} press />
        <View style={styles.pnl}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{costKnown ? VERDICT_UI.netPnl : VERDICT_UI.paidOut}</Text>
          <Text style={[TYPE.dataHero, { color: pnlInk }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatBaseUnits(verdict.pnlBase, verdict.decimals, { signed: true })}
          </Text>
          <Text style={[TYPE.data, { color: color.inkMuted }]}>{symbol}</Text>
          {!costKnown ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{VERDICT_UI.costUnknown}</Text> : null}
        </View>
      </View>

      <View accessibilityLabel={VERDICT_UI.legs}>
        {verdict.legs.map((leg) => (
          <View key={leg.outcomeIdx} style={[styles.leg, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
              {SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]}{" "}
              <Text style={[TYPE.data, { color: color.inkSecondary }]}>
                {formatBaseUnits(leg.amountRaw, verdict.decimals)} {VERDICT_UI.contracts}
              </Text>
            </Text>
            <Text style={[TYPE.data, { color: color.inkSecondary }]}>
              {VERDICT_UI.payout} <Text style={{ color: color.ink }}>{formatBaseUnits(leg.payoutBase, verdict.decimals)}</Text>
            </Text>
          </View>
        ))}
      </View>

      <ClaimWinnings verdict={verdict} marketId={market.marketId} symbol={symbol} />

      <View style={[styles.paper, { backgroundColor: color.cream, shadowColor: color.shadow }]}>
        <View style={styles.paperHead}>
          <View>
            <Text style={[TYPE.labelMicro, { color: color.creamInk, opacity: 0.6 }]}>{VERDICT_UI.receiptTitle}</Text>
            <Text style={[TYPE.dataLg, { color: color.creamInk }]}>
              {formatBaseUnits(verdict.payoutBase, verdict.decimals)} {symbol}
            </Text>
            <Text style={[TYPE.caption, { color: color.creamInk, opacity: 0.6 }]}>{VERDICT_UI.paidOut}</Text>
          </View>
          <VerdictStamp outcome={verdict.outcome} size="compact" onPaper />
        </View>
        <View style={[styles.rule, { borderColor: color.creamHairline }]} />
        <PaperRow label={VERDICT_UI.window} value={`${market.asset} · ${formatCadence(market.intervalSec)} · ${sides}`} />
        <PaperRow label={VERDICT_UI.openingPrint} value={oraclePriceText(resolution?.openingRaw ?? market.openingPriceRaw, market.asset)} />
        <PaperRow label={VERDICT_UI.closingPrint} value={oraclePriceText(resolution?.closingRaw ?? null, market.asset)} />
        <PaperRow
          label={VERDICT_UI.settlementTx}
          value={settlementTx ? shortHex(settlementTx, 10, 4) : VERDICT_UI.pendingTx}
          onPress={settlementTx ? () => openExternal(explorerUrl("tx", settlementTx)) : undefined}
        />
        <PaperRow
          label={VERDICT_UI.oracleGraph}
          value={source ? VERDICT_UI.question(source) : VERDICT_UI.noQuestion}
          onPress={source ? () => router.push({ pathname: "/proof/[id]", params: { id: market.marketId } }) : undefined}
        />
        <Text style={[TYPE.caption, { color: color.creamInk, opacity: 0.55 }]}>{new Date(settledAtMs).toUTCString()}</Text>
      </View>

      <ShareButton text={buildTradeTweetText(toTradeCard(verdict, market, resolution, symbol, settledAtMs))} />
    </View>
  );
}

function PaperRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const { color } = useTheme();
  const body = (
    <View style={styles.paperRow}>
      <Text style={[TYPE.caption, { color: color.creamInk, opacity: 0.65 }]}>{label}</Text>
      <Text style={[TYPE.data, styles.paperValue, { color: onPress ? color.accent : color.creamInk }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      {body}
    </Pressable>
  ) : (
    body
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
  wrap: { gap: 16 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  pnl: { alignItems: "flex-end", flexShrink: 1 },
  leg: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  paper: { borderRadius: RADIUS.lg, padding: 18, gap: 8, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  paperHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rule: { borderTopWidth: 1, borderStyle: "dashed", marginVertical: 4 },
  paperRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, minHeight: 30, alignItems: "center" },
  paperValue: { flexShrink: 1, textAlign: "right", fontFamily: FONT.data },
});
