import { quickChips } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LUCKY } from "@/features/games/lucky/copy";
import { TICKET } from "@/lib/copy";
import { Press } from "~/features/games/frame";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { useLuckyTokens } from "./parts";

interface Props {
  reels: ReactNode;
  stakeText: string;
  onStake: (text: string) => void;
  symbol: string;
  decimals: number | null;
  availableBase: bigint | null;
  belowMin: boolean;
  floorText: string;
  busy: boolean;
  reduced: boolean;
  spinLabel: string;
  canSpin: boolean;
  /** Why SPIN is shut, said under it while the machine is at rest. */
  note: string | null;
  closedNote: string | null;
  onSpin: () => void;
}

/**
 * web's `.lk-cabinet` (LuckyStage): Pips' slot band as one opaque card — the three reels, the stake in the pixel
 * face with the Ticket's own quick amounts beneath, the vermilion SPIN with its raised lip, and the line that says
 * why it is shut (and, out of hours, that spins draw only from the 24/7 names).
 */
export function LuckyCabinet(p: Props) {
  const { lk, color } = useLuckyTokens();
  const chips = p.availableBase !== null && p.decimals !== null ? quickChips(p.availableBase, p.decimals) : [];
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!p.busy || p.reduced) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.3, { duration: 600 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [p.busy, p.reduced, pulse]);
  const busyStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.cabinet, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={LUCKY.title}>
      {p.reels}

      <View style={styles.stake}>
        <View style={styles.stakeHead}>
          <Text style={[styles.stakeK, { color: color.inkMuted }]}>{LUCKY.stake.label.toUpperCase()}</Text>
          {p.availableBase !== null && p.decimals !== null ? (
            <Text style={[styles.avail, { color: color.inkMuted }]}>{LUCKY.stake.available(`${formatBaseUnits(p.availableBase, p.decimals)} ${p.symbol}`)}</Text>
          ) : null}
        </View>
        <View style={[styles.field, { borderColor: color.hairline, backgroundColor: lk.well }]}>
          <TextInput
            value={p.stakeText}
            onChangeText={p.onStake}
            editable={!p.busy}
            keyboardType="decimal-pad"
            autoComplete="off"
            placeholder={LUCKY.stake.placeholder}
            placeholderTextColor={color.inkDisabled}
            accessibilityLabel={LUCKY.stake.aria(p.symbol)}
            style={[styles.input, { color: color.ink }]}
          />
          <Text style={[styles.unit, { color: color.inkMuted }]}>{p.symbol}</Text>
        </View>
        {p.decimals !== null && !p.busy && chips.length > 0 ? (
          <View style={styles.chips} accessibilityLabel={TICKET.chips}>
            {chips.map((chip) => (
              <Press
                key={chip.label}
                disabled={!chip.enabled}
                onPress={() => p.onStake(formatBaseUnits(chip.stakeBase, p.decimals ?? 0, { group: false, minDp: 0 }))}
                accessibilityRole="button"
                accessibilityLabel={chip.enabled ? chip.label : `${chip.label} — ${TICKET.chipBelowMin}`}
                style={[styles.chip, { backgroundColor: color.surface2 }, !chip.enabled && styles.chipOff]}
              >
                <Text style={[styles.chipText, { color: color.ink }]}>{chip.label}</Text>
              </Press>
            ))}
          </View>
        ) : null}
        {p.belowMin ? <Text style={[styles.min, { color: color.accent }]}>{LUCKY.stake.minimum(p.floorText)}</Text> : null}
      </View>

      <Animated.View style={p.busy ? busyStyle : null}>
        <Press
          onPress={p.onSpin}
          disabled={!p.canSpin}
          accessibilityRole="button"
          accessibilityLabel={p.note ?? LUCKY.spin.cta}
          accessibilityState={{ disabled: !p.canSpin, busy: p.busy }}
          style={(pressed) => [
            styles.cta,
            { backgroundColor: color.accent, borderColor: lk.ctaBorder, boxShadow: pressed ? lk.ctaShadowPressed : lk.ctaShadow },
            !p.canSpin && styles.ctaOff,
          ]}
        >
          <Text style={[styles.ctaText, { color: color.ground }]}>{p.spinLabel.toUpperCase()}</Text>
        </Press>
      </Animated.View>
      {p.note ? <Text style={[styles.note, { color: color.inkSecondary }]}>{p.note}</Text> : null}
      {p.closedNote ? <Text style={[styles.note, { color: color.inkSecondary }]}>{p.closedNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cabinet: { gap: 12, borderRadius: 20, padding: 16, borderWidth: 1 },
  stake: { gap: 8 },
  stakeHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  stakeK: { fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 19.2, letterSpacing: 2.4 },
  avail: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, fontVariant: ["tabular-nums"] },
  field: { flexDirection: "row", alignItems: "baseline", gap: 8, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  input: { flex: 1, minWidth: 0, padding: 0, fontFamily: PIXEL_FONT, fontSize: 33, lineHeight: 36, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, height: 44, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  chipOff: { opacity: 0.5 },
  chipText: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  min: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  cta: { minHeight: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaOff: { opacity: 0.55 },
  ctaText: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 26, letterSpacing: 3.96 },
  note: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, textAlign: "center" },
});
