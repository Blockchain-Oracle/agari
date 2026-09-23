import type { BookedOrder } from "@agari/core/ports";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { useOpeningPrice } from "@agari/markets/react";
import { router } from "expo-router";
import { openExternal } from "~/lib/external";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSettlementFee } from "@/features/markets/verdict/useVerdict";
import { callBandLabel, callWinBase, shortCallId, type CallCard } from "@/features/share/call-card";
import { SHARE } from "@/features/share/copy";
import { marketsEnv } from "~/lib/env";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web's PlacedCall → The Call: the booked order and its Window as the chain has them, on the cream paper card. */
export function CallReceipt({ booked, market, decimals, symbol, onAnother }: { booked: BookedOrder; market: EventMarket; decimals: number; symbol: string; onAnother: () => void }) {
  const { color } = useTheme();
  const [placedIn] = useState(() => market);
  const [placedAtMs] = useState(() => Date.now());
  const opening = useOpeningPrice(placedIn.marketId);
  const fee = useSettlementFee(placedIn.marketId, true);
  const card: CallCard = {
    asset: placedIn.asset, side: booked.side, intervalSec: placedIn.intervalSec,
    lineRaw: opening?.ok ? opening.value : placedIn.openingPriceRaw,
    stakeBase: booked.costBase, contractsRaw: booked.contractsRaw, decimals, symbol,
    feeBps: fee?.ok ? fee.value : null, expirySec: placedIn.expirySec, txHash: booked.txHash, placedAtMs, leverage: null,
  };
  const ink = color.creamInk;
  const sideInk = booked.side === "up" ? color.profit : color.loss;
  return (
    <Animated.View entering={ZoomIn.springify().damping(16)} style={[styles.paper, { backgroundColor: color.cream, shadowColor: color.shadow }]}>
      <Text style={[TYPE.labelMicro, { color: ink, opacity: 0.6 }]}>{SHARE.call.recordType}</Text>
      <Text style={[styles.side, { color: sideInk }]}>{booked.side === "up" ? SHARE.call.up : SHARE.call.down}</Text>
      <Text style={[TYPE.title, { color: ink }]}>{callBandLabel(card)}</Text>
      <Text style={[TYPE.caption, { color: ink, opacity: 0.7 }]}>{SHARE.call.winsIf(placedIn.asset, booked.side)}</Text>
      <View style={[styles.rule, { borderColor: color.creamHairline }]} />
      <View style={styles.row}>
        <Figure label={SHARE.call.youStake} value={`${formatBaseUnits(booked.costBase, decimals)} ${symbol}`} ink={ink} />
        <Figure label={SHARE.call.winIfLands} value={`${formatBaseUnits(callWinBase(card), decimals)} ${symbol}`} ink={sideInk} note={SHARE.call.afterFee} />
      </View>
      <Pressable onPress={() => openExternal(txUrl(booked.txHash, marketsEnv.cluster))} accessibilityRole="link">
        <Text style={[TYPE.data, { color: ink, opacity: 0.7 }]}>#{shortCallId(card)} ↗</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={() => { router.back(); router.navigate("/portfolio"); }} style={[styles.action, { borderColor: color.creamHairline }]}>
          <Text style={[styles.actionText, { color: ink }]}>{SHARE.call.portfolio}</Text>
        </Pressable>
        <Pressable onPress={onAnother} style={[styles.action, { borderColor: color.creamHairline }]}>
          <Text style={[styles.actionText, { color: ink }]}>{SHARE.call.another}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Figure({ label, value, ink, note }: { label: string; value: string; ink: string; note?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={[TYPE.labelMicro, { color: ink, opacity: 0.6 }]}>{label}</Text>
      <Text style={[TYPE.dataLg, { color: ink }]}>{value}</Text>
      {note ? <Text style={[TYPE.caption, { color: ink, opacity: 0.55 }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: RADIUS.lg, padding: 20, gap: 8, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  side: { fontFamily: FONT.stamp, fontSize: 28 },
  rule: { borderTopWidth: 1, borderStyle: "dashed", marginVertical: 6 },
  row: { flexDirection: "row", gap: 12 },
  figure: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  action: { flex: 1, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: FONT.bodyStrong, fontSize: 14 },
});
