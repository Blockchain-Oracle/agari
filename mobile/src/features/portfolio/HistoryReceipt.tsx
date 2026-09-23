import { formatCadence, verdictStrings } from "@agari/core/copy";
import { toVerdict, type SettledRound } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { OUTCOME_TO_SIDE } from "@agari/core/types";
import { formatOracleRaw, formatUtc, secToMs, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { useMarket, useResolution } from "@agari/markets/react";
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { isBasketAsset, ORACLE_SCALE } from "@/features/markets/hero/units";
import { printSourceText } from "@/features/markets/verdict/print-source";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { VERDICT_UI } from "@/lib/copy";
import { Button } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { marketsEnv } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { money, signedMoney } from "./format";

/** web `oraclePriceText`: dollars in the print's scale, points for a basket. */
function oracleText(raw: bigint | null, asset: string): string {
  if (raw === null) return "—";
  return isBasketAsset(asset) ? `${formatOracleRaw(raw, ORACLE_SCALE)} pts` : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}

/** One cream receipt row: the label, the value, and where it links (explorer, the print proof page). */
function ReceiptRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const { color } = useTheme();
  const body = (
    <View style={[styles.rrow, { borderBottomColor: color.creamHairline }]}>
      <Text style={[TYPE.caption, { color: color.creamInk, opacity: 0.7 }]}>{label}</Text>
      <Text style={[styles.rvalue, { color: color.creamInk }]} numberOfLines={1}>
        {value}
        {onPress ? " ↗" : ""}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}: ${value}`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

function Body({ round, symbol }: { round: SettledRound; symbol: string }) {
  const { color } = useTheme();
  const market = useMarket(round.marketId);
  const resolution = useResolution(round.marketId);
  const verdict = toVerdict(round);
  const res = resolution && isOk(resolution) ? resolution.value : null;
  const opening = res?.openingRaw ?? (market && isOk(market) ? market.value?.openingPriceRaw ?? null : null);
  const strings = verdictStrings(verdict.outcome);
  const stampInk = verdict.outcome === "win" ? color.accent : verdict.outcome === "loss" ? color.ink : color.inkMuted;
  const settledAtMs = verdict.settledAtMs ?? res?.settledAtMs ?? secToMs(round.expirySec);
  const source = printSourceText(res, round.expirySec, round.asset);
  const costKnown = verdict.costBasisBase !== null;
  const sides = verdict.legs.map((leg) => SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]).join(" + ");
  const d = round.decimals;

  return (
    <View style={styles.bodyGap}>
      <View style={styles.head}>
        <View>
          <Text style={[TYPE.stampHero, { color: stampInk }]}>{strings.kanji}</Text>
          <Text style={[TYPE.labelMicro, { color: color.inkSecondary, textTransform: "none" }]}>
            {strings.romaji} · {strings.translation}
          </Text>
        </View>
        <View style={styles.pnl}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{costKnown ? VERDICT_UI.netPnl : VERDICT_UI.paidOut}</Text>
          <Text style={[TYPE.dataLg, { color: verdict.pnlBase > 0n ? color.profit : verdict.pnlBase < 0n ? color.loss : color.ink }]}>{signedMoney(verdict.pnlBase, d, symbol)}</Text>
        </View>
      </View>
      {!costKnown ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{VERDICT_UI.costUnknown}</Text> : null}
      {round.outcome === "closed" ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{HISTORY.outcome.closed}</Text> : null}
      {verdict.outcome === "void" ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>{strings.line}</Text> : null}
      {verdict.legs.map((leg) => (
        <View key={leg.outcomeIdx} style={[styles.leg, { borderBottomColor: color.hairline }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
            {SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]} <Text style={[TYPE.data, { color: color.inkSecondary }]}>{money(leg.amountRaw, d)} {VERDICT_UI.contracts}</Text>
          </Text>
          <Text style={[TYPE.data, { color: color.inkSecondary }]}>
            {VERDICT_UI.payout} <Text style={{ color: color.ink }}>{money(leg.payoutBase, d, symbol)}</Text>
          </Text>
        </View>
      ))}
      <View style={[styles.paper, { backgroundColor: color.cream, shadowColor: color.shadow }]}>
        <Text style={[TYPE.labelMicro, { color: color.creamInk, opacity: 0.6 }]}>{VERDICT_UI.receiptTitle}</Text>
        <Text style={[TYPE.dataHero, { color: color.creamInk }]}>{money(verdict.payoutBase, d)}</Text>
        <Text style={[TYPE.caption, { color: color.creamInk, opacity: 0.7 }]}>
          {VERDICT_UI.paidOut} · {formatUtc(settledAtMs, { withSeconds: false, withDate: true })}
        </Text>
        <ReceiptRow label={VERDICT_UI.window} value={`${round.asset} · ${formatCadence(round.intervalSec)} · ${sides}`} />
        <ReceiptRow label="Staked" value={money(round.stakeBase, d, symbol)} />
        {round.proceedsBase > 0n ? <ReceiptRow label="Sold before expiry" value={money(round.proceedsBase, d, symbol)} /> : null}
        <ReceiptRow label={VERDICT_UI.openingPrint} value={oracleText(opening, round.asset)} />
        <ReceiptRow label={VERDICT_UI.closingPrint} value={oracleText(res?.closingRaw ?? null, round.asset)} />
        <ReceiptRow
          label={VERDICT_UI.settlementTx}
          value={res?.settlementTxHash ? shortHex(res.settlementTxHash, 10, 4) : VERDICT_UI.pendingTx}
          onPress={res?.settlementTxHash ? () => void openExternal(txUrl(res.settlementTxHash as NonNullable<typeof res.settlementTxHash>, marketsEnv.cluster)) : undefined}
        />
        <ReceiptRow label={VERDICT_UI.oracleGraph} value={source ?? VERDICT_UI.noQuestion} onPress={source ? () => router.push({ pathname: "/proof/[id]", params: { id: round.marketId } }) : undefined} />
        {round.source !== "vault" ? (
          <ReceiptRow label={HISTORY.entryTx} value={shortHex(round.entryTxHash, 10, 4)} onPress={() => void openExternal(txUrl(round.entryTxHash, marketsEnv.cluster))} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * web `HistoryReceipt`: one settled round's receipt in a native page sheet — the stamped verdict (上がり / 放銃 / 無効),
 * the net result, every leg, then the cream settlement receipt with its prints, the settlement tx and the print proof.
 */
export function HistoryReceipt({ round, symbol, onClose }: { round: SettledRound | null; symbol: string; onClose: () => void }) {
  const { color } = useTheme();
  return (
    <Modal visible={round !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body}>
        <View style={styles.top}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.receiptTitle}</Text>
          <Button label="Done" variant="ghost" size="sm" block={false} onPress={onClose} />
        </View>
        {round ? <Body key={round.marketId} round={round} symbol={symbol} /> : null}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingBottom: 48, gap: 16 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  bodyGap: { gap: 14 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  pnl: { alignItems: "flex-end", gap: 4 },
  leg: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8, gap: 8, flexWrap: "wrap" },
  paper: { borderRadius: RADIUS.md, padding: 16, gap: 6, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  rrow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  rvalue: { fontFamily: FONT.data, fontSize: 13, flexShrink: 1, textAlign: "right" },
});
