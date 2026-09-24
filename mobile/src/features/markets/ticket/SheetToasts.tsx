import { Platform, StyleSheet, Text, View } from "react-native";
import { useToasts } from "~/components/toast/store";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * The app's toasts, repeated inside the ticket sheet. The root Toaster draws beneath a presented form sheet, so a
 * boost's or a private bet's refusal (web's hooks report those only as toasts) would otherwise vanish unseen.
 * iOS draws the root Toaster in a full-window overlay above every sheet, so this repeat is Android's only.
 */
export function SheetToasts() {
  const { color } = useTheme();
  const toasts = useToasts();
  if (toasts.length === 0 || Platform.OS === "ios") return null;
  return (
    <View style={styles.stack} accessibilityLiveRegion="polite">
      {toasts.map((toast) => (
        <View key={toast.id} style={[styles.toast, { backgroundColor: color.surface2, borderColor: toast.tone === "warning" ? color.warning : color.hairline }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{toast.title}</Text>
          {toast.description ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{toast.description}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 6 },
  toast: { borderWidth: 1, borderRadius: RADIUS.md, padding: 10, gap: 2 },
});
