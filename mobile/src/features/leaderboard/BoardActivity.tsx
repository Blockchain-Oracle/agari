import type { Reading } from "@agari/core/schemas";
import { Text, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { ago } from "@/features/stats/copy";
import type { TractionData } from "@/features/stats";
import { SectionHeader } from "~/components/kit";
import { TractionTape } from "~/features/stats/TractionTape";
import { TYPE, useTheme } from "~/theme";

/**
 * web's `BoardActivity` (features/leaderboard/BoardActivity.tsx), Masayume's "Live activity": the latest calls and
 * cash-outs off the venue's fill tape, read through the same `/api/traction` poll `/stats` uses.
 */
export function BoardActivity({ reading, nowMs }: { reading: Reading<TractionData> | null; nowMs: number }) {
  const { color } = useTheme();
  const words = LEADERBOARD.activity;
  const traction = reading?.ok ? reading.value : null;
  const updated = traction && nowMs > 0 ? words.updated(ago(traction.meta.computedAtMs, nowMs)) : undefined;
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader index={words.number} title={words.title} desc={words.desc} aside={updated} />
      {traction && nowMs > 0 ? (
        <TractionTape events={traction.recent} decimals={traction.meta.decimals} symbol={traction.meta.symbol} nowMs={nowMs} />
      ) : (
        <Text style={[TYPE.caption, { color: color.inkMuted }]} accessibilityRole="text">
          {reading !== null && !reading.ok ? words.unreachable : words.reading}
        </Text>
      )}
    </View>
  );
}
