import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOutUp, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { dismissToast, useToasts, type ToastItem } from "./store";

/** web's toasts (lib/toast: neutral for records, warning for degraded truth) as capsules under the island. */
export function Toaster() {
  const toasts = useToasts();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 6 }]}>
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </View>
  );
}

function Toast({ toast }: { toast: ToastItem }) {
  const { color } = useTheme();
  useEffect(() => {
    Haptics.notificationAsync(toast.tone === "warning" ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
  }, [toast.tone]);
  return (
    <Animated.View entering={SlideInUp.springify().damping(18)} exiting={FadeOutUp.duration(180)}>
      <Pressable onPress={() => dismissToast(toast.id)} accessibilityRole="alert" style={[styles.toast, { backgroundColor: color.surface3, borderColor: color.hairline }]}>
        {toast.tone === "warning" ? <View style={[styles.dot, { backgroundColor: color.warning }]} /> : null}
        <View style={styles.copy}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>{toast.title}</Text>
          {toast.description ? <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={2}>{toast.description}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, gap: 8, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, maxWidth: 380 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { flexShrink: 1, gap: 1 },
});
