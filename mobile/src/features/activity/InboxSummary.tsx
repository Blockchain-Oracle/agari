import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MoneyUnits } from "@/features/activity/describe";
import type { ActivityItem } from "@/features/activity/protocol";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";

interface Tally {
  fills: number;
  wins: number;
  losses: number;
  claimBase: bigint;
}

function tally(items: readonly ActivityItem[]): Tally {
  let fills = 0;
  let wins = 0;
  let losses = 0;
  let claimBase = 0n;
  for (const item of items) {
    if (item.kind === "fill" || item.kind === "resting-filled") fills += 1;
    else if (item.kind === "settled-win") wins += 1;
    else if (item.kind === "settled-loss") losses += 1;
    else if (item.kind === "claimable" && item.amountBase !== null) claimBase += BigInt(item.amountBase);
  }
  return { fills, wins, losses, claimBase };
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" | "accent" }) {
  const { color } = useTheme();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : tone === "accent" ? color.accent : color.ink;
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.value, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, { color: color.inkMuted }]}>{label}</Text>
    </View>
  );
}

// 21st: 7ovr/activity-4 — the inbox panel's header counts over the feed's own rows.
/**
 * A count strip over the inbox rows on screen: fills, wins and losses in the latest events the index returned, and the
 * payouts still waiting in their seats (tap to collect them in Portfolio). Every figure is a count of the rows below.
 */
export function InboxSummary({ items, units }: { items: readonly ActivityItem[]; units: MoneyUnits }) {
  const { color } = useTheme();
  if (items.length === 0) return null;
  const t = tally(items);
  const claim = units.decimals !== null && t.claimBase > 0n ? `${formatBaseUnits(t.claimBase, units.decimals)} ${units.symbol}` : "—";
  return (
    <View style={[styles.strip, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Cell label="Fills" value={String(t.fills)} />
      <Cell label="Won" value={String(t.wins)} tone={t.wins > 0 ? "profit" : undefined} />
      <Cell label="Lost" value={String(t.losses)} tone={t.losses > 0 ? "loss" : undefined} />
      <Pressable
        style={({ pressed }) => [styles.claim, { borderLeftColor: color.hairline }, pressed && { backgroundColor: color.surface2 }]}
        disabled={t.claimBase === 0n}
        onPress={() => {
          haptic.tap();
          router.push("/portfolio");
        }}
        accessibilityRole="button"
        accessibilityLabel={`To claim: ${claim}. Open Portfolio`}
      >
        <Cell label="To claim" value={claim} tone={t.claimBase > 0n ? "accent" : undefined} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, gap: 2, alignItems: "center" },
  claim: { flex: 1.6, borderLeftWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  value: { fontFamily: FONT.dataStrong, fontSize: 16 },
  label: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase" },
});
