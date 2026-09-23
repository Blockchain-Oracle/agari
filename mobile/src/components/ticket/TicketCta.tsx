import { blockerLabel, type BlockerContext, type BlockerKind } from "@agari/core/copy";
import type { Side } from "@agari/core/types";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";

interface Props {
  blocker: BlockerKind | null;
  ctx: BlockerContext;
  side: Side | null;
  /** The armed label: "Buy UP for 5.00 tUSDC", the exact most it can cost. */
  label: string;
  /** Opens the review (SignReview): the exact quote and the maximum loss, then the slide. */
  onReview: () => void;
}

/**
 * web's TicketCta / BlockedButton: a blocked ticket names why on the control itself (the label IS the blocker); a ready
 * one carries the side's ink and the exact most the order can cost, and opens the review rather than signing.
 */
export function TicketCta({ blocker, ctx, side, label, onReview }: Props) {
  const { color } = useTheme();
  if (blocker) {
    return (
      <View accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel={blockerLabel(blocker, ctx)} style={[styles.blocked, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
        <Text style={[styles.blockedText, { color: color.inkSecondary }]} numberOfLines={2}>
          {blockerLabel(blocker, ctx)}
        </Text>
      </View>
    );
  }
  return <Button label={label} size="lg" variant={side === "down" ? "loss" : side === "up" ? "profit" : "primary"} icon={{ ios: "checkmark.shield", android: "verified_user" }} onPress={onReview} />;
}

const styles = StyleSheet.create({
  blocked: { minHeight: 52, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  blockedText: { fontFamily: FONT.bodyStrong, fontSize: 14, textAlign: "center" },
});
