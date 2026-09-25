import { toVerdict, type SettledRound } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { useMarket, useResolution } from "@agari/markets/react";
import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HISTORY } from "@/features/markets/history/copy";
import { VerdictCard } from "~/features/markets/verdict/VerdictCard";
import { useTheme } from "~/theme";

function ReceiptBody({ round, symbol }: { round: SettledRound; symbol: string }) {
  const market = useMarket(round.marketId);
  const resolution = useResolution(round.marketId);
  const openingPriceRaw = market && isOk(market) ? (market.value?.openingPriceRaw ?? null) : null;
  return (
    <VerdictCard
      verdict={toVerdict(round)}
      market={{ marketId: round.marketId, asset: round.asset, intervalSec: round.intervalSec, expirySec: round.expirySec, openingPriceRaw }}
      resolution={resolution && isOk(resolution) ? resolution.value : null}
      symbol={symbol}
    />
  );
}

/**
 * web `HistoryReceipt`: one settled round's Verdict in the bottom sheet (`.history-receipt-sheet` over the blurred
 * scrim — the ground, a hairline top, rounded-t-xl, 88 % tall at most, the ghost close at the top right). The card
 * inside is the same Verdict the live Window stamps, so a settled row and the moment it settled never disagree.
 */
export function HistoryReceipt({ round, symbol, onClose }: { round: SettledRound | null; symbol: string; onClose: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={round !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.sheet, { backgroundColor: color.ground, borderTopColor: color.hairline, paddingBottom: 20 + insets.bottom }]}
          accessibilityViewIsModal
          accessibilityLabel={round ? `${HISTORY.receiptTitle}. ${round.asset} · ${HISTORY.outcome[round.outcome]}` : HISTORY.receiptTitle}
        >
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {round ? <ReceiptBody key={round.marketId} round={round} symbol={symbol} /> : null}
          </ScrollView>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close} hitSlop={4}>
            <X size={16} color={color.ink} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "88%", borderTopWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingTop: 20, paddingHorizontal: 16 },
  scroll: { paddingBottom: 4 },
  close: { position: "absolute", top: 12, right: 12, width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
