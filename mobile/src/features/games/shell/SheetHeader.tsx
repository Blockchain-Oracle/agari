import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SPACE, TYPE, useTheme } from "~/theme";

/** A sheet's top bar: the grabber, the title in Sora, and one close control (web's plate close button). */
export function SheetHeader({ title, eyebrow, onClose, closeLabel }: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  closeLabel: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.grabber, { backgroundColor: color.borderStrong }]} />
      <View style={styles.row}>
        <View style={styles.titles}>
          {eyebrow ? <Text style={[TYPE.labelMicro, { color: color.accent }]}>{eyebrow}</Text> : null}
          <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.close, { backgroundColor: pressed ? color.surface3 : color.surface2 }]}
        >
          <SymbolView name={{ ios: "xmark", android: "close" }} size={15} tintColor={color.inkSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SPACE.gutter, paddingTop: 8, paddingBottom: 4, gap: 10 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  titles: { flex: 1, gap: 4 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
