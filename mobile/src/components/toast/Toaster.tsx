import { BlurView } from "expo-blur";
import { Info, TriangleAlert, X } from "lucide-react-native";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { haptic } from "~/components/kit/haptics";
import { FONT, useTheme } from "~/theme";
import { chromeTokens } from "~/theme/chrome";
import { dismissToast, useToasts, type ToastItem } from "./store";

/** The dock's height and bottom offset (components/shell/BottomDock): web's toast sits just above the pill nav. */
const DOCK_HEIGHT = 60;

/**
 * web's Toaster (components/ui/toast.tsx + styles/toast.css, limit 1): bottom of the screen, 16 pt in from each side,
 * at most 384 wide, just above the pill nav; a 12-radius translucent plate with a hairline tinted by type, a 16 pt
 * lucide icon, the title in Inter 500 14 and the line under it muted, a close ✕. It springs in from the right and
 * swipes away right or down.
 */
export function Toaster() {
  const toasts = useToasts();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(12.8, insets.bottom - 8) + DOCK_HEIGHT + 8;
  // A mounted full-window overlay hides the whole app from VoiceOver (and the UI test driver), so it exists only
  // while a toast is on screen.
  if (toasts.length === 0) return null;
  const host = (
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </View>
  );
  // iOS presents dialogs in their own window layer; the full-window overlay keeps a refusal visible above them.
  return Platform.OS === "ios" ? <FullWindowOverlay>{host}</FullWindowOverlay> : host;
}

function Toast({ toast }: { toast: ToastItem }) {
  const { name, color } = useTheme();
  const t = chromeTokens(name);
  const warning = toast.tone === "warning";
  const x = useSharedValue(420);
  const y = useSharedValue(0);

  useEffect(() => {
    if (warning) haptic.error();
    else haptic.success();
    // --ease-bounce over 500 ms: web's overshooting entry from translateX(120%).
    x.value = withSpring(0, { damping: 22, stiffness: 300 });
  }, [warning, x]);

  const close = () => dismissToast(toast.id);
  const swipe = Gesture.Pan()
    .onUpdate((e) => {
      x.value = Math.max(0, e.translationX);
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationX > 60 || e.velocityX > 600) x.value = withTiming(600, { duration: 200 }, () => runOnJS(close)());
      else if (e.translationY > 30 || e.velocityY > 500) y.value = withTiming(200, { duration: 200, easing: Easing.in(Easing.quad) }, () => runOnJS(close)());
      else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });
  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const Icon = warning ? TriangleAlert : Info;

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View accessibilityRole="alert" style={[styles.plate, { borderColor: warning ? t.toastWarnBorder : t.toastBorder }, moved]}>
        <BlurView intensity={40} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.toastBg }]} />
        <View style={styles.content}>
          <Icon size={16} color={warning ? color.warning : t.toastIcon} strokeWidth={2} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: t.toastInk }]}>{toast.title}</Text>
            {toast.description ? <Text style={[styles.desc, { color: t.toastMuted }]}>{toast.description}</Text> : null}
          </View>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close toast" style={styles.close}>
            <X size={16} color={t.toastMuted} strokeWidth={2} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  plate: { width: "100%", maxWidth: 384, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  content: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 20 },
  desc: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  close: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
