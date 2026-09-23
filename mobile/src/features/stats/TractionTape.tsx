import { formatBaseUnits, shortHex } from "@agari/core/units";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ago, STATS } from "@/features/stats/copy";
import type { TractionEvent } from "@/features/stats/protocol";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";

/**
 * web's live-activity rows (features/stats/StatsSections.tsx `ActivityList`): dot, kind · side · asset, the wallet,
 * the stake and its age. The row opens the fill's transaction on Solana Explorer; the wallet opens its account there.
 */
export function TractionTape({ events, decimals, symbol, nowMs }: { events: readonly TractionEvent[]; decimals: number; symbol: string; nowMs: number }) {
  const { color } = useTheme();
  if (events.length === 0) return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{STATS.activity.empty}</Text>;
  return (
    <View>
      {events.map((event) => {
        const call = event.kind === "call";
        const title = `${STATS.activity.kind[event.kind]} · ${event.side.toUpperCase()} · ${event.asset}`;
        return (
          <Pressable
            key={event.id}
            onPress={() => {
              haptic.tap();
              void openExternal(explorerUrl("tx", event.txHash));
            }}
            accessibilityRole="link"
            accessibilityLabel={`${title}, ${shortHex(event.wallet, 6, 4)}, ${ago(event.atMs, nowMs)}. Open on Solana Explorer`}
            style={({ pressed }) => [styles.row, { borderBottomColor: color.hairline }, pressed && { backgroundColor: color.surface1 }]}
          >
            <View style={[styles.dot, { backgroundColor: call ? color.accent : color.inkMuted }]} />
            <AssetDisc asset={event.asset} size={26} />
            <View style={styles.text}>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
                {title}
              </Text>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  void openExternal(explorerUrl("address", event.wallet));
                }}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel={`Wallet ${shortHex(event.wallet, 6, 4)} on Solana Explorer`}
              >
                <Text style={[styles.mono, { color: color.inkSecondary }]}>{shortHex(event.wallet, 6, 4)}</Text>
              </Pressable>
            </View>
            <View style={styles.right}>
              {event.stakeBase > 0n ? (
                <Text style={[TYPE.data, { color: color.ink }]}>
                  {formatBaseUnits(event.stakeBase, decimals)} <Text style={[styles.mono, { color: color.inkMuted }]}>{symbol}</Text>
                </Text>
              ) : null}
              <Text style={[styles.mono, { color: color.inkMuted }]}>{ago(event.atMs, nowMs)}</Text>
            </View>
            <SymbolView name={{ ios: "arrow.up.right", android: "north_east" }} size={12} tintColor={color.inkMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { flex: 1, gap: 2 },
  right: { alignItems: "flex-end", gap: 2 },
  mono: { fontFamily: FONT.data, fontSize: 11.5 },
});
