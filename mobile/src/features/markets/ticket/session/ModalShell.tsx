import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SESSION } from "@/features/session/copy";
import { FONT, useTheme } from "~/theme";
import { sessionTokens } from "~/theme/web/markets-session";

export function useSessionTokens() {
  const { name, color } = useTheme();
  return { t: sessionTokens(name), color, name };
}

/**
 * web's SessionModalShell (modal.css): the one dialog shape — a centred panel (max 448, radius 16, 1 px hairline,
 * #0d0d10) over a 70 % black, 4 px-blurred scrim that closes it; the ✕ in the corner, the head (the vermilion eyebrow
 * dot, "TAP-TRADING · SESSION KEY", the Sora 800 title, the description), a scrolling body and a footer that stays.
 * Drawn in place over the ticket drawer, as web's sits above it (z-index 10000).
 */
export function ModalShell({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  const { t, color, name } = useSessionTokens();
  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={10} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={SESSION.modal.close} />
        </View>
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: t.panel, borderColor: t.panelBorder, shadowColor: t.shadow }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={SESSION.modal.close} hitSlop={6} style={styles.close}>
            <X size={16} color={t.close} />
          </Pressable>
          <View style={styles.head}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, { backgroundColor: t.dot, shadowColor: t.dot }]} />
              <Text style={[styles.eyebrow, { color: t.eyebrow }]}>{SESSION.modal.eyebrow}</Text>
            </View>
            <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
              {title}
            </Text>
            <Text style={[styles.desc, { color: t.desc }]}>{description}</Text>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.foot}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** web's `<details className="modal-disclosure">`: the mono summary with its + / −, the content 12 px under it. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  const { t } = useSessionTokens();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} style={styles.summary}>
        <Text style={[styles.sign, { color: t.summary }]}>{open ? "−" : "+"}</Text>
        <Text style={[styles.summaryText, { color: t.summary }]}>{summary}</Text>
      </Pressable>
      {open ? <View style={styles.disclosed}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  panel: { width: "100%", maxWidth: 448, maxHeight: "90%", borderWidth: 1, borderRadius: 16, shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 25 }, elevation: 24 },
  close: { position: "absolute", right: 16, top: 16, zIndex: 1, borderRadius: 999, padding: 8 },
  head: { paddingTop: 28, paddingHorizontal: 28 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, paddingRight: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  eyebrow: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15, letterSpacing: 2, textTransform: "uppercase" },
  title: { marginBottom: 4, paddingRight: 32, fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 28.8, letterSpacing: -0.6 },
  desc: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.75 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingVertical: 16, paddingHorizontal: 28, gap: 16 },
  foot: { paddingHorizontal: 28, paddingBottom: 28, gap: 8 },
  summary: { flexDirection: "row", alignItems: "center", gap: 6 },
  sign: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 12 },
  summaryText: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26, textTransform: "uppercase" },
  disclosed: { marginTop: 12, gap: 12 },
});
