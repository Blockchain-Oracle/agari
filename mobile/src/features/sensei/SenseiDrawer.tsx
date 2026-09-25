import { router } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SENSEI_UI } from "@/features/sensei/copy";
import { useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";

const PANEL_MS = 420;
const SCRIM_MS = 300;
/** part-02's drawer curve, cubic-bezier(.22,1,.36,1), and the scrim's --ease. */
const PANEL_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SCRIM_EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * web's `.sensei-drawer` over its `.sensei-drawer-scrim` (yosuku part-02): a min(400 px, 92vw) panel — 370 pt on a
 * 402 pt phone — fixed to the right edge over everything, chrome and dock included, sliding in from 104 % over 420 ms
 * while the scrim fades in over 300 ms. Tapping the scrim, ✕ or the system back slides it out, then leaves the route.
 */
export function SenseiDrawer({ children }: { children: (close: () => void) => ReactNode }) {
  const { name } = useTheme();
  const t = senseiTokens(name);
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(400, screen * 0.92);
  const open = useSharedValue(0);
  const scrim = useSharedValue(0);

  useEffect(() => {
    open.value = withTiming(1, { duration: PANEL_MS, easing: PANEL_EASE });
    scrim.value = withTiming(1, { duration: SCRIM_MS, easing: SCRIM_EASE });
  }, [open, scrim]);

  const leave = () => {
    if (router.canGoBack()) router.back();
  };
  const close = () => {
    scrim.value = withTiming(0, { duration: SCRIM_MS, easing: SCRIM_EASE });
    open.value = withTiming(0, { duration: PANEL_MS, easing: PANEL_EASE }, (done) => {
      if (done) runOnJS(leave)();
    });
  };

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - open.value) * width * 1.04 }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={SENSEI_UI.close} accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={SENSEI_UI.title}
        style={[styles.panel, { width, paddingTop: insets.top, backgroundColor: t.panel, borderLeftColor: t.panelEdge, shadowColor: t.panelShadow }, panelStyle]}
      >
        {children(close)}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", top: 0, right: 0, bottom: 0, borderLeftWidth: 1, shadowOpacity: 1, shadowRadius: 35, shadowOffset: { width: -30, height: 0 }, elevation: 24 },
});
