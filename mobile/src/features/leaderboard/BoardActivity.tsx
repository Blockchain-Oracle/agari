import type { Reading } from "@agari/core/schemas";
import { StyleSheet, View } from "react-native";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { ago } from "@/features/stats/copy";
import type { TractionData } from "@/features/stats";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { ActivityCard, ActivityList, ActivityNote } from "~/features/stats/ActivityList";

/** The phone board shows the latest few. */
const ROWS = 6;

/**
 * web's `BoardActivity`, compact for a phone: the section head, the latest six calls and cash-outs on web's stats
 * rows, each opening its transaction.
 */
export function BoardActivity({ reading, nowMs }: { reading: Reading<TractionData> | null; nowMs: number }) {
  const words = LEADERBOARD.activity;
  const traction = reading?.ok ? reading.value : null;
  const updated = traction && nowMs > 0 ? words.updated(ago(traction.meta.computedAtMs, nowMs)) : undefined;
  return (
    <View>
      <SectionHeader index={words.number} title={words.title} eyebrow={updated} style={styles.head} />
      {traction && nowMs > 0 ? (
        <ActivityList events={traction.recent.slice(0, ROWS)} decimals={traction.meta.decimals} symbol={traction.meta.symbol} nowMs={nowMs} />
      ) : (
        <ActivityCard>
          <ActivityNote text={reading !== null && !reading.ok ? words.unreachable : words.reading} />
        </ActivityCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 32, marginBottom: 12 },
});
