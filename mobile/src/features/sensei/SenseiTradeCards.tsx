import type { EventMarket } from "@agari/core/types";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SENSEI_UI } from "@/features/sensei/copy";
import { haptic } from "~/components/kit";
import { WindowCard } from "~/features/ticker-hub/WindowCard";
import { TYPE, useTheme } from "~/theme";

/**
 * web's `SenseiTradeCards`: act on the read without leaving — each Window at the top of its real book; a side hands
 * off to the one Ticket with it chosen (never a second signing path inside the chat). The Ticket opens over the
 * Sensei sheet, so closing it lands back in the conversation. Hideable, as web's are.
 */
export function SenseiTradeCards({ markets, nowMs }: { markets: readonly EventMarket[]; nowMs: number }) {
  const { color } = useTheme();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.ink }]}>{SENSEI_UI.tradeHead}</Text>
        <Text style={[TYPE.caption, styles.sub, { color: color.inkMuted }]}>{SENSEI_UI.tradeSub}</Text>
        <Pressable
          onPress={() => {
            haptic.select();
            setHidden(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={SENSEI_UI.tradeHide}
          hitSlop={12}
          style={styles.hide}
        >
          <SymbolView name={{ ios: "xmark", android: "close" }} size={13} tintColor={color.inkSecondary} />
        </Pressable>
      </View>
      {markets.length === 0 ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{SENSEI_UI.tradeEmpty}</Text> : null}
      {markets.map((market) => (
        <WindowCard key={market.marketId} market={market} nowMs={nowMs} note={SENSEI_UI.perDollar} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  sub: { flex: 1 },
  hide: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
