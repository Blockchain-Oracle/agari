import { formatUtc } from "@agari/core/units";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PROOF_CAPTION } from "@agari/core/copy";
import { haptic } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { proofTokens } from "~/theme/web/explore/proof";

interface ReceiptProps {
  title: string;
  figure: string;
  figureLabel: string;
  settledAtMs: number;
  footer: string;
  children?: ReactNode;
}

/**
 * web's components/receipt `Receipt`: the cream stub (the only inverted surface and the only shadow) — the vermilion
 * bar, the micro title, the figure with its label and UTC time, the ledger rows, the perforated tear line with its two
 * notches in the ground, and the footer.
 */
export function Receipt({ title, figure, figureLabel, settledAtMs, footer, children }: ReceiptProps) {
  const { name, color } = useTheme();
  const t = proofTokens(name);
  return (
    <View style={[styles.shadow, { shadowColor: t.receiptShadow }]}>
      <View style={[styles.paper, { backgroundColor: color.cream }]}>
        <View style={[styles.bar, { backgroundColor: color.accent }]} />
        <View style={styles.body}>
          <Text style={[styles.micro, { color: t.creamInk70 }]}>{title}</Text>
          <View style={styles.figureBlock}>
            <Text style={[styles.micro, { color: t.creamInk70 }]}>{figureLabel}</Text>
            <Text style={[styles.figure, { color: color.creamInk }]} numberOfLines={1} adjustsFontSizeToFit>
              {figure}
            </Text>
            <Text style={[styles.data, { color: t.creamInk80 }]}>{formatUtc(settledAtMs, { withSeconds: true, withDate: true })}</Text>
          </View>
          {children ? <View style={styles.rows}>{children}</View> : null}
        </View>
        <View style={[styles.stub, { borderTopColor: color.creamHairline }]} accessibilityRole="none">
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: color.ground }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: color.ground }]} />
        </View>
        <Text style={[styles.footer, { color: t.creamInk70 }]}>{footer}</Text>
      </View>
    </View>
  );
}

/**
 * web's `ReceiptRow`: label … dotted leader … value. With `explorer` the value is web's `ProofLink` — the dotted
 * underlined hash with "Don't trust it. Click it." under it — opening that transaction or account on Solana Explorer;
 * `hash` is web's bare `Hash` link (the replay's post and close transactions), with no caption.
 */
export function ReceiptRow({ label, children, explorer, hash = false }: { label: string; children: ReactNode; explorer?: { kind: "tx" | "address"; id: string }; hash?: boolean }) {
  const { name, color } = useTheme();
  const t = proofTokens(name);
  return (
    <View style={styles.row}>
      <Text style={[styles.data, styles.label, { color: t.creamInk80 }]}>{label}</Text>
      <View style={[styles.leader, { borderBottomColor: color.creamHairline }]} />
      {explorer ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            void openExternal(explorerUrl(explorer.kind, explorer.id));
          }}
          accessibilityRole="link"
          accessibilityLabel={`${label}: open on Solana Explorer`}
          hitSlop={8}
          style={styles.link}
        >
          <Text style={[styles.data, styles.linkText, { color: color.creamInk, textDecorationColor: color.creamInk }]}>{children}</Text>
          {hash ? null : <Text style={[styles.caption, { color: color.creamInk }]}>{PROOF_CAPTION}</Text>}
        </Pressable>
      ) : (
        <Text style={[styles.data, styles.value, { color: color.creamInk }]} selectable>
          {children}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // --receipt-shadow: 0 18px 40px -18px rgb(0 0 0 / 0.6), 0 6px 14px -8px rgb(0 0 0 / 0.45)
  shadow: { borderRadius: 8, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 18 }, elevation: 8 },
  paper: { borderRadius: 8, overflow: "hidden" },
  bar: { height: 6 },
  body: { padding: 20, gap: 16 },
  micro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  figureBlock: { gap: 4 },
  figure: { fontFamily: FONT.bodyStrong, fontSize: 36.18, lineHeight: 38, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  data: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18.2, fontVariant: ["tabular-nums"] },
  rows: { gap: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  label: { flexShrink: 0 },
  // The dotted leader sits 0.3em above the baseline (-translate-y-[0.3em] on a 14 px line).
  leader: { flex: 1, minWidth: 0, height: 1, marginTop: 13, borderBottomWidth: 1, borderStyle: "dotted" },
  value: { flexShrink: 1, textAlign: "right" },
  link: { alignItems: "flex-end", flexShrink: 1 },
  linkText: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
  caption: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, opacity: 0.7 },
  stub: { borderTopWidth: 1, borderStyle: "dashed", height: 0 },
  notch: { position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8 },
  notchLeft: { left: -8 },
  notchRight: { right: -8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76 },
});
