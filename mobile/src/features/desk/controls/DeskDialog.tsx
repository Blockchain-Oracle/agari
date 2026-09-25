import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeskTheme } from "../kit";

/**
 * web's DeskDialog.tsx below 768 px (21st Credenza #1354 as a drawer): the scrim, then a bottom sheet in the card
 * surface with a hairline top edge, 16 px top corners, a round close button top right, and the card inside it with
 * its own frame dropped. Tapping the scrim closes it, as Base UI's backdrop does.
 */
export function DeskDialog({ open, onClose, title, children, locked = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; locked?: boolean }) {
  const { color } = useDeskTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={locked ? undefined : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Animated.View entering={FadeIn.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]}>
          <Pressable style={styles.fill} onPress={locked ? undefined : onClose} accessibilityLabel="Close" />
        </Animated.View>
        <View style={styles.viewport} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1)).withInitialValues({ transform: [{ translateY: 40 }] })}
            style={[styles.sheet, { backgroundColor: color.surface1, borderColor: color.hairline, paddingBottom: 20 + insets.bottom, boxShadow: `0 24px 64px -24px ${color.scrim}` }]}
            accessibilityViewIsModal
            accessibilityLabel={title}
          >
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
            </ScrollView>
            <Pressable onPress={onClose} disabled={locked} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} style={[styles.close, { borderColor: color.hairline, backgroundColor: color.surface2 }]}>
              <X size={16} color={color.inkSecondary} />
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  viewport: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end" },
  sheet: { width: "100%", maxHeight: "88%", paddingTop: 20, borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  body: { paddingHorizontal: 16, gap: 14 },
  close: { position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
