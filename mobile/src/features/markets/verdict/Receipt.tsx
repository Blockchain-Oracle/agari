import { formatUtc } from "@agari/core/units";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { PROOF_CAPTION, RECEIPT_FOOTER, RECEIPT_TITLE } from "@/lib/copy";
import { FONT, useTheme } from "~/theme";
import { wordsTokens } from "~/theme/web/markets-words";

interface ReceiptProps {
  figure: ReactNode;
  figureLabel: string;
  settledAtMs: number;
  stamp?: ReactNode;
  children?: ReactNode;
}

/**
 * web's components/receipt `Receipt`: the cream stub — the app's only inverted surface and its only shadow. A 6 pt
 * vermilion band, the title with the stamp, the monument figure over the settled UTC time, the ledger rows, the
 * perforated tear with its two notches, and the footer.
 */
export function Receipt({ figure, figureLabel, settledAtMs, stamp, children }: ReceiptProps) {
  const { name, color } = useTheme();
  const t = wordsTokens(name);
  return (
    <View style={[styles.shadow, { shadowColor: color.shadow }]}>
      <View style={[styles.paper, { backgroundColor: color.cream }]}>
        <View style={[styles.band, { backgroundColor: color.accent }]} />
        <View style={styles.body}>
          <View style={styles.header}>
            <Text style={[styles.micro, { color: t.creamInk70 }]}>{RECEIPT_TITLE}</Text>
            {stamp}
          </View>
          <View style={styles.figureBlock}>
            <Text style={[styles.micro, { color: t.creamInk70 }]}>{figureLabel}</Text>
            {figure}
            <Text style={[styles.data, { color: t.creamInk80 }]}>{formatUtc(settledAtMs, { withDate: true })}</Text>
          </View>
          {children ? <View style={styles.rows}>{children}</View> : null}
        </View>
        <View style={styles.stub}>
          <Rule color={color.creamHairline} dash="4 3" />
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: color.ground }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: color.ground }]} />
        </View>
        <Text style={[styles.micro, styles.footer, { color: t.creamInk70 }]}>{RECEIPT_FOOTER}</Text>
      </View>
    </View>
  );
}

/**
 * web's `ReceiptRow` + `ProofLink`: label … dotted leader … value. A link carries web's "Don't trust it. Click it."
 * under it; `href === null` marks the proof source as degraded in warning ink.
 */
export function ReceiptRow({ label, value, onPress, degradedLabel }: { label: string; value: string; onPress?: (() => void) | null; degradedLabel?: string }) {
  const { name, color } = useTheme();
  const t = wordsTokens(name);
  return (
    <View style={styles.row}>
      <Text style={[styles.data, { color: t.creamInk80 }]}>{label}</Text>
      <View style={styles.leader}>
        <Rule color={color.creamHairline} dash="1 3" />
      </View>
      {onPress === undefined ? (
        <Text style={[styles.data, styles.value, { color: color.creamInk }]}>{value}</Text>
      ) : onPress === null ? (
        <View style={styles.proof}>
          <Text style={[styles.data, styles.value, { color: color.creamInk }]}>{value}</Text>
          <Text style={[styles.caption, { color: color.warning }]}>{degradedLabel}</Text>
        </View>
      ) : (
        <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6} style={styles.proof}>
          <Text style={[styles.data, styles.value, styles.link, { color: color.creamInk }]}>{value}</Text>
          <Text style={[styles.caption, styles.soft, { color: color.creamInk }]}>{PROOF_CAPTION}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A dashed or dotted 1 pt rule: React Native draws a single-side dashed border solid, so the line is drawn instead. */
function Rule({ color, dash }: { color: string; dash: string }) {
  return (
    <Svg width="100%" height={1}>
      <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={color} strokeWidth={1} strokeDasharray={dash} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: 8, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 18 } },
  paper: { borderRadius: 8, overflow: "hidden" },
  band: { height: 6 },
  body: { padding: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  micro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  figureBlock: { gap: 4 },
  data: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18.2, fontVariant: ["tabular-nums"] },
  rows: { gap: 8 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  leader: { flex: 1, minWidth: 8, height: 1, transform: [{ translateY: -4 }] },
  value: { textAlign: "right", flexShrink: 1 },
  proof: { alignItems: "flex-end", flexShrink: 1 },
  link: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
  caption: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76 },
  soft: { opacity: 0.7 },
  stub: { height: 1 },
  notch: { position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8 },
  notchLeft: { left: -8 },
  notchRight: { right: -8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, textTransform: "none" },
});
