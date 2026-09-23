import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Logo } from "~/components/logos/Logo";
import type { NavItem } from "~/nav/items";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** One drawer row: tinted icon tile, name, web's one-line description, chevron. */
export function NavRow({ item, onPress, last }: { item: NavItem; onPress: () => void; last: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={item.description}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? color.surface2 : "transparent" }]}
    >
      <View style={[styles.tile, { backgroundColor: item.logo ? color.surface2 : color.accentWash }]}>
        {item.logo ? <Logo brand={item.logo} size={15} /> : <SymbolView name={item.icon} size={17} tintColor={color.accent} />}
      </View>
      <View style={[styles.text, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline }]}>
        <View style={styles.copy}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{item.name}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={1}>{item.description}</Text>
        </View>
        <SymbolView name={{ ios: item.external ? "arrow.up.right" : "chevron.right", android: item.external ? "open_in_new" : "chevron_right" }} size={13} tintColor={color.inkMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 12, gap: 12, borderRadius: RADIUS.lg },
  tile: { width: 32, height: 32, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingRight: 14, gap: 8 },
  copy: { flex: 1, gap: 1 },
});
