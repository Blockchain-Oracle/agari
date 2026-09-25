import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";

/**
 * web `.fund-modal-root`: a blurred black/70 scrim and, centred with 16 of inset, the 16-radius card on #0d0d10 (the
 * ground in light) with its white/10 border, 28 of padding and the gray-600 X at 16/16. Tapping the scrim closes.
 */
export function FundModal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.fundScrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={label} />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(200)} accessibilityViewIsModal style={[styles.card, { backgroundColor: t.fundPaper, borderColor: t.fundBorder }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          {children}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.close, pressed && { backgroundColor: t.fundLine }]}>
          <X size={16} color={color.inkDisabled} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  card: { width: "100%", maxWidth: 448, maxHeight: "100%", borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  scroll: { padding: 28 },
  close: { position: "absolute", right: 16, top: 16, borderRadius: 999, padding: 8 },
});
