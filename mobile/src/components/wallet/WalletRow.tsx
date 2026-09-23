import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Logo } from "~/components/logos/Logo";
import { AgariMark } from "~/components/shell/AgariMark";
import { RADIUS, TYPE, useTheme } from "~/theme";
import type { WalletChoice } from "~/wallet/choices";

/** One wallet in the connect sheet (21st "Connect Wallet Modal" grammar): its own mark, name, how it connects, an arrow. */
export function WalletRow({ choice, index, busy, onPress }: { choice: WalletChoice; index: number; busy: boolean; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(80 * index).springify().damping(18)}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Connect with ${choice.name}`}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? color.surface2 : color.surface1, borderColor: color.hairline }]}
      >
        <View style={[styles.mark, { backgroundColor: choice.logo ? "transparent" : color.ground, borderColor: color.hairline }]}>
          {choice.logo ? <Logo brand={choice.logo} size={40} radius={RADIUS.md} /> : <AgariMark width={17} height={21} />}
        </View>
        <View style={styles.copy}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{choice.name}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{choice.line}</Text>
        </View>
        {busy ? <ActivityIndicator color={color.accent} /> : <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={15} tintColor={color.inkMuted} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  mark: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  copy: { flex: 1, gap: 1 },
});
