import { formatCadence } from "@agari/core/copy";
import { ownCentsOf } from "@agari/core/orders";
import type { RestedOrder } from "@agari/core/ports";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { laneAssetLabel } from "@/features/markets/lanes/lane-view";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useCancelResting } from "@/features/markets/ticket/useCancelResting";
import { PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { FONT } from "~/theme";
import { Quiet } from "./AccountGate";
import { TxHash } from "./OutcomeNote";
import { ReadoutCell, ReadoutRow } from "./Readout";
import { GateCta } from "./TicketButton";
import { useTk } from "./tk";

/**
 * web's ScheduledCall (D-088): the receipt a scheduled call leaves where the composer was, in the gate's block — what
 * is held, the contracts and the price, which Window and when it fills or comes back, the transaction, and Cancel
 * (`user_cancel_orders` on the call's own handle; the escrow returns to venue credit).
 */
export function ScheduledCall({ rested, market, decimals, onAnother }: { rested: RestedOrder; market: EventMarket; decimals: number; onAnother: () => void }) {
  const tk = useTk();
  const when = useWhen();
  const cancel = useCancelResting();
  const cents = ownCentsOf(rested.side, rested.priceTicks);
  const untilLock = rested.expireSec >= market.lockAtSec;
  const line = [styles.line, { color: tk.gateLine }];
  return (
    <View style={[styles.gate, { borderColor: tk.gateBorder, backgroundColor: tk.gateBg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.eyebrow, { color: tk.vermilion }]}>{PREOPEN.receipt.eyebrow}</Text>
      <ReadoutRow live>
        <ReadoutCell index={0} label={PREOPEN.receipt.held}>
          {formatBaseUnits(rested.escrowBase, decimals)}
        </ReadoutCell>
        <ReadoutCell index={1} label={PREOPEN.receipt.contracts}>
          {formatBaseUnits(rested.contractsRaw, decimals, { minDp: 0 })}
        </ReadoutCell>
        <ReadoutCell index={2} label={PREOPEN.receipt.price}>
          {cents}¢
        </ReadoutCell>
      </ReadoutRow>
      <Text style={line}>
        {PREOPEN.receipt.window}: {laneAssetLabel(market.asset, market.lane)} · {formatCadence(market.intervalSec)} · {SIDE_WORD[rested.side]} · {PREOPEN.receipt.opens(when(market.tradingStartSec))}
      </Text>
      <Text style={line}>
        {PREOPEN.receipt.fillsBy} {untilLock ? PREOPEN.receipt.lock : PREOPEN.receipt.bell}.
      </Text>
      <Text style={line}>
        {PREOPEN.receipt.tx} <TxHash hash={rested.txHash} color={tk.gateLine} />
      </Text>
      {cancel.canSign && cancel.note ? <Text style={line}>{cancel.note}</Text> : null}
      <View style={styles.actions}>
        {cancel.canSign && !cancel.done ? (
          <GateCta label={cancel.busy ? PREOPEN.receipt.cancelling : PREOPEN.receipt.cancel} disabled={cancel.busy} onPress={() => void cancel.cancel(rested.marketId, [{ node: rested.node, seq: rested.seq }])} />
        ) : null}
        <Quiet
          label={PREOPEN.receipt.portfolio}
          onPress={() => {
            router.back();
            router.navigate("/portfolio");
          }}
        />
        <Quiet label={PREOPEN.receipt.another} onPress={onAnother} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { borderWidth: 1, padding: 16 },
  eyebrow: { marginBottom: 6, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  line: { marginBottom: 10, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
});
