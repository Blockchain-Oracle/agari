import type { Reading } from "@agari/core/schemas";
import { View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { ago } from "@/features/stats/copy";
import type { TractionData } from "@/features/stats";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { ActivityCard, ActivityList, ActivityNote } from "~/features/stats/ActivityList";

/**
 * web's `BoardActivity` (features/leaderboard/BoardActivity.tsx), Masayume's "Live activity": `/stats`' own rows off
 * the venue's fill tape, read through the same `/api/traction` poll; the card holds the reading line until then.
 */
export function BoardActivity({ reading, nowMs }: { reading: Reading<TractionData> | null; nowMs: number }) {
  const words = LEADERBOARD.activity;
  const traction = reading?.ok ? reading.value : null;
  const updated = traction && nowMs > 0 ? words.updated(ago(traction.meta.computedAtMs, nowMs)) : undefined;
  return (
    <View>
      <SectionHeader index={words.number} title={words.title} desc={words.desc} eyebrow={updated} style={{ marginTop: 48, marginBottom: 24 }} />
      {traction && nowMs > 0 ? (
        <ActivityList events={traction.recent} decimals={traction.meta.decimals} symbol={traction.meta.symbol} nowMs={nowMs} />
      ) : (
        <ActivityCard>
          <ActivityNote text={reading !== null && !reading.ok ? words.unreachable : words.reading} />
        </ActivityCard>
      )}
    </View>
  );
}
