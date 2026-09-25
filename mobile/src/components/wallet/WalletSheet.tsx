import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { useTheme } from "~/theme";

/** Leaves the route the dialog lives on, or lands on Markets when it was opened cold. */
export function dismiss(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/markets");
}

/**
 * web `WalletDialog` below 768 px: RainbowKit's blurred scrim and its bottom sheet — the panel full width, surface-1,
 * no border, the top corners at radius-xl, sliding up on RainbowKit's 350 ms spring-ish curve. Tapping the scrim closes.
 */
export function WalletSheet({ children, onClose = dismiss }: { children: ReactNode; onClose?: () => void }) {
  const { color, name } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <BlurView intensity={12} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={WALLET_MODAL.close} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(350).easing(Easing.bezier(0.15, 1.15, 0.6, 1))}
        accessibilityViewIsModal
        style={[styles.panel, { backgroundColor: color.surface1, paddingBottom: insets.bottom }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  panel: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
});
