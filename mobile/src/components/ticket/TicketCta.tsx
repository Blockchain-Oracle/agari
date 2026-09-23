import { blockerLabel, type BlockerContext, type BlockerKind } from "@agari/core/copy";
import type { Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { TICKET } from "@/lib/copy";
import { SlideToConfirm } from "~/components/ui/SlideToConfirm";
import { FONT, RADIUS, useTheme } from "~/theme";

/** web's TicketCta: a blocked ticket names why on the control itself; a ready one is slid to buy at the quoted most. */
export function TicketCta({ blocker, ctx, side, costBase, decimals, symbol, onConfirm }: {
  blocker: BlockerKind | null; ctx: BlockerContext; side: Side | null; costBase: bigint | null; decimals: number; symbol: string; onConfirm: () => void;
}) {
  const { color } = useTheme();
  if (blocker) {
    return (
      <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={[styles.blocked, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
        <Text style={[styles.blockedText, { color: color.inkSecondary }]} numberOfLines={2}>{blockerLabel(blocker, ctx)}</Text>
      </View>
    );
  }
  const label = side && costBase !== null ? `${TICKET.buy(SIDE_WORD[side])} ${formatBaseUnits(costBase, decimals)} ${symbol}` : TICKET.buyPlain;
  return <SlideToConfirm label={label} onConfirm={onConfirm} tone={side === "down" ? color.loss : side === "up" ? color.profit : color.accent} />;
}

const styles = StyleSheet.create({
  blocked: { minHeight: 60, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  blockedText: { fontFamily: FONT.bodyStrong, fontSize: 14, textAlign: "center" },
});
