import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptic } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";

/**
 * web's `ReceiptRow` (components/receipt) on the cream paper: the label left, the value right in mono. With `explorer`
 * the row is a link that opens that transaction or account on Solana Explorer.
 */
export function ReceiptRow({ label, children, explorer }: { label: string; children: ReactNode; explorer?: { kind: "tx" | "address"; id: string } }) {
  const { color } = useTheme();
  const value = (
    <Text style={[styles.value, { color: explorer ? color.accent : color.creamInk }]} selectable={!explorer}>
      {children}
    </Text>
  );
  if (!explorer) {
    return (
      <View style={[styles.row, { borderTopColor: color.creamHairline }]}>
        <Text style={[styles.label, { color: color.creamInk }]}>{label}</Text>
        {value}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        void openExternal(explorerUrl(explorer.kind, explorer.id));
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}: open on Solana Explorer`}
      style={({ pressed }) => [styles.row, styles.link, { borderTopColor: color.creamHairline }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.label, { color: color.creamInk }]}>{label}</Text>
      {value}
      <SymbolView name={{ ios: "arrow.up.right", android: "north_east" }} size={11} tintColor={color.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  link: { minHeight: 44 },
  label: { fontFamily: FONT.body, fontSize: 12.5, flexShrink: 0, maxWidth: "42%" },
  value: { flex: 1, fontFamily: FONT.data, fontSize: 12, textAlign: "right" },
});
