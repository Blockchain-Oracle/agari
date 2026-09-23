import { formatCadence } from "@agari/core/copy";
import { ownCentsOf } from "@agari/core/orders";
import type { RestedOrder } from "@agari/core/ports";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { laneAssetLabel } from "@/features/markets/lanes/lane-view";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useCancelResting } from "@/features/markets/ticket/useCancelResting";
import { PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { Button, SignReview } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { LIGHT } from "~/theme/palette";

/**
 * web's ScheduledCall: what rests, at what price, what is held, and when it fills or comes back — on the cream paper
 * where the composer was. Cancel is live at once (behind its own review): `user_cancel_orders` on the call's handle,
 * the escrow back to venue credit.
 */
export function ScheduledReceipt({ rested, market, decimals, symbol, onAnother }: { rested: RestedOrder; market: EventMarket; decimals: number; symbol: string; onAnother: () => void }) {
  const { color } = useTheme();
  const when = useWhen();
  const cancel = useCancelResting();
  const [confirming, setConfirming] = useState(false);
  const cents = ownCentsOf(rested.side, rested.priceTicks);
  const untilLock = rested.expireSec >= market.lockAtSec;
  const ink = color.creamInk;
  const held = `${formatBaseUnits(rested.escrowBase, decimals)} ${symbol}`;
  const cell = (label: string, value: string) => (
    <View style={styles.cell}>
      <Text style={[TYPE.labelMicro, { color: ink, opacity: 0.6 }]}>{label}</Text>
      <Text style={[TYPE.dataLg, { color: ink }]}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.stack}>
      <View style={[styles.paper, { backgroundColor: color.cream, shadowColor: color.shadow }]} accessibilityRole="summary">
        <Text style={[TYPE.labelMicro, { color: LIGHT.accent }]}>{PREOPEN.receipt.eyebrow}</Text>
        <View style={styles.cells}>
          {cell(PREOPEN.receipt.held, held)}
          {cell(PREOPEN.receipt.contracts, formatBaseUnits(rested.contractsRaw, decimals, { minDp: 0 }))}
          {cell(PREOPEN.receipt.price, `${cents}¢`)}
        </View>
        <View style={[styles.rule, { borderColor: color.creamHairline }]} />
        <Text style={[TYPE.body, { color: ink }]}>
          {PREOPEN.receipt.window}: {laneAssetLabel(market.asset, market.lane)} · {formatCadence(market.intervalSec)} · {SIDE_WORD[rested.side]} · {PREOPEN.receipt.opens(when(market.tradingStartSec))}
        </Text>
        <Text style={[TYPE.caption, { color: ink, opacity: 0.75 }]}>
          {PREOPEN.receipt.fillsBy} {untilLock ? PREOPEN.receipt.lock : PREOPEN.receipt.bell}.
        </Text>
        <Pressable onPress={() => openExternal(explorerUrl("tx", rested.txHash))} accessibilityRole="link" style={styles.tx} hitSlop={8}>
          <Text style={[TYPE.data, { color: LIGHT.accent }]}>
            {PREOPEN.receipt.tx} {rested.txHash.slice(0, 10)}
          </Text>
          <SymbolView name={{ ios: "arrow.up.right", android: "north_east" }} size={12} tintColor={LIGHT.accent} />
        </Pressable>
        {cancel.note ? <Text style={[TYPE.caption, { color: ink }]}>{cancel.note}</Text> : null}
      </View>
      {cancel.canSign && !cancel.done ? (
        confirming ? (
          <SignReview
            title={PREOPEN.receipt.cancel}
            lines={[
              { label: PREOPEN.receipt.held, value: held },
              { label: PREOPEN.receipt.price, value: `${cents}¢` },
            ]}
            maxLoss={null}
            confirmLabel="Slide to cancel"
            phase={cancel.busy ? "signing" : "review"}
            onConfirm={() => void cancel.cancel(rested.marketId, [{ node: rested.node, seq: rested.seq }])}
          />
        ) : (
          <Button label={PREOPEN.receipt.cancel} variant="destructive" onPress={() => setConfirming(true)} />
        )
      ) : null}
      <View style={styles.actions}>
        <Button
          label={PREOPEN.receipt.portfolio}
          variant="secondary"
          style={styles.grow}
          onPress={() => {
            router.back();
            router.navigate("/portfolio");
          }}
        />
        <Button label={PREOPEN.receipt.another} variant="outline" style={styles.grow} onPress={onAnother} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  paper: { borderRadius: RADIUS.lg, padding: 18, gap: 8, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  cells: { flexDirection: "row", gap: 8 },
  cell: { flex: 1, gap: 2 },
  rule: { borderTopWidth: 1, borderStyle: "dashed", marginVertical: 4 },
  tx: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  actions: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
});
