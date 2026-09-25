import type { OutcomeColumn } from "@agari/core/desk";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { RECORD } from "@/features/desk/copy-record";
import { FONT, useTheme } from "~/theme";
import { deskEntryTokens } from "~/theme/web/products/desk-entry";

/** This family's web tokens for the active theme. */
export function useDeskEntryTokens() {
  return deskEntryTokens(useTheme().name);
}

/** web's text utilities as the desk pages use them (bridge.css type scale, studio.css labels). */
export const T = StyleSheet.create({
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  /** .st-label / .dk-panel-title: mono 11 px, 0.12em, uppercase. */
  label: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32, textTransform: "uppercase" },
  /** .dk-eyebrow: mono 11 px, 0.14em. */
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54, textTransform: "uppercase" },
  hint: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.75 },
  /** .dk-title: Sora 800 30 px, -0.02em, 1.05. */
  title: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 31.5, letterSpacing: -0.6 },
});

/** A card's wash as web paints it: `radial-gradient(120% 80% at 100% 0%, …)` or a top-down `linear-gradient`. */
export function Wash({ id, kind, color, fade }: { id: string; kind: "corner" | "top"; color: string; fade: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          {kind === "corner" ? (
            <RadialGradient id={id} cx="100%" cy="0%" rx="120%" ry="80%" fx="100%" fy="0%" gradientUnits="objectBoundingBox">
              <Stop offset="0" stopColor={color} stopOpacity={1} />
              <Stop offset={String(fade)} stopColor={color} stopOpacity={0} />
            </RadialGradient>
          ) : (
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={1} />
              <Stop offset={String(fade)} stopColor={color} stopOpacity={0} />
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** A 1 px dashed rule (`border-top: 1px dashed`): React Native dashes only whole borders, so this clips one. */
export function DashedRule({ style }: { style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  return (
    <View style={[styles.dashClip, style]} pointerEvents="none">
      <View style={[styles.dash, { borderColor: color.hairline }]} />
    </View>
  );
}

/** studio.css `.st-btn` (and `.st-btn-lg`): a pill in Sora 700; primary is the accent with its glow. */
export function StBtn({ label, onPress, primary, lg, disabled, before, after, style }: { label: string; onPress: () => void; primary?: boolean; lg?: boolean; disabled?: boolean; before?: LucideIcon; after?: LucideIcon; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  const ink = primary ? color.onAccent : color.ink;
  const Before = before;
  const After = after;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        lg && styles.btnLg,
        primary ? [styles.glow, { backgroundColor: color.accent, borderColor: color.accent, shadowColor: color.accent }] : { borderColor: color.hairline },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {Before ? <Before size={16} color={ink} /> : null}
      <Text style={[styles.btnText, lg && styles.btnTextLg, { color: ink }]}>{label}</Text>
      {After ? <After size={16} color={ink} /> : null}
    </Pressable>
  );
}

/** studio.css `.st-pill`: the small outline action under the mix. */
export function StPill({ label, icon: Icon, onPress, disabled }: { label: string; icon: LucideIcon; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={[styles.pill, { borderColor: color.hairline }, disabled && styles.disabled]}>
      <Icon size={14} color={color.inkSecondary} />
      <Text style={[styles.pillText, { color: color.inkSecondary }]}>{label}</Text>
    </Pressable>
  );
}

export type Level = "careful" | "balanced" | "loose";

/** studio.css `.st-icon-tile`: a 40 px rounded tile, tinted by level. */
export function IconTile({ icon: Icon, level }: { icon: LucideIcon; level: Level }) {
  const { color } = useTheme();
  const tk = useDeskEntryTokens();
  const [bg, ink] = level === "careful" ? [color.profitWash, color.profit] : level === "balanced" ? [color.accentWash, color.accent] : [tk.looseWash, color.warning];
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Icon size={20} color={ink} />
    </View>
  );
}

/** studio.css `.st-label` (a section's mono caption). */
export function StLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  return <Text style={[T.label, { color: color.inkMuted }, style]}>{children}</Text>;
}

/** studio.css `.st-hint`. */
export function StHint({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <Text style={[T.hint, { color: color.inkMuted }]}>{children}</Text>;
}

/** desk.css `.dk-card` (`.st-first` rings it in the accent's dim). */
export function DkCard({ children, first }: { children: ReactNode; first?: boolean }) {
  const { color } = useTheme();
  return <View style={[styles.card, { backgroundColor: color.surface1, borderColor: first ? color.accentDim : color.hairline }]}>{children}</View>;
}

/** studio.css `.st-cash-disc`: the "$" disc the cash sleeve wears (30 px in the rows, 22 px on the side card). */
export function CashDisc({ size = 30 }: { size?: number }) {
  const { color } = useTheme();
  return (
    <View style={[styles.cash, { width: size, height: size, borderRadius: size / 2, backgroundColor: color.surface2 }]}>
      <Text style={{ fontFamily: FONT.dataStrong, fontSize: size === 30 ? 14 : 11, color: color.inkSecondary }}>$</Text>
    </View>
  );
}

/** studio.css `.st-by`: who enforces a limit, the program in the accent. */
export function StBy({ by, text }: { by: "program" | "code"; text: string }) {
  const { color } = useTheme();
  const program = by === "program";
  return (
    <View style={[styles.by, { borderColor: program ? color.accentDim : color.hairline, backgroundColor: program ? color.accentWash : undefined }]}>
      <Text style={[styles.byText, { color: program ? color.accent : color.inkMuted }]}>{text}</Text>
    </View>
  );
}

const OUTCOME_TONE: Record<OutcomeColumn, "acted" | "asked" | "quiet" | "stopped"> = {
  acted: "acted", acted_in_part: "acted", acted_by_override: "acted", would_have_acted: "acted",
  asked: "asked", nothing_to_do: "quiet", waited: "quiet", declined: "quiet",
  not_executed: "stopped", blocked_by_limit: "stopped", failed: "stopped",
};

/** web's Outcome.tsx: one outcome as a mono chip, acted in the accent, asked in warning, quiet muted, stopped in loss. */
export function Outcome({ outcome, practice }: { outcome: OutcomeColumn; practice?: boolean }) {
  const { color } = useTheme();
  const tone = OUTCOME_TONE[outcome];
  const ink = tone === "acted" ? color.accent : tone === "asked" ? color.warning : tone === "quiet" ? color.inkMuted : color.loss;
  return (
    <Text style={[styles.outcome, { color: ink }]}>
      {RECORD.outcome[outcome]}
      {practice ? ` · ${RECORD.list.practiceTag}` : ""}
    </Text>
  );
}

/** desk-kit `EmptyState` (21st #1435): a dashed box, an icon tile, a title and a line. */
export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: color.hairline }]}>
      <View style={[styles.emptyIcon, { backgroundColor: color.surface2 }]}>
        <Icon size={24} color={color.inkSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: color.ink }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: color.inkSecondary }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dashClip: { height: 1, overflow: "hidden" },
  dash: { height: 3, borderWidth: 1, borderStyle: "dashed" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 42, paddingHorizontal: 18, borderRadius: 9999, borderWidth: 1 },
  btnLg: { minHeight: 48, paddingHorizontal: 24 },
  glow: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 8, elevation: 4 },
  btnText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  btnTextLg: { fontSize: 15, lineHeight: 24 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  pillText: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 20 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  card: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  cash: { alignItems: "center", justifyContent: "center" },
  by: { paddingVertical: 2, paddingHorizontal: 9, borderRadius: 9999, borderWidth: 1 },
  byText: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 0.42 },
  outcome: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88, textTransform: "uppercase" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 16, borderWidth: 1, borderStyle: "dashed", borderRadius: 14 },
  emptyIcon: { width: 48, height: 48, marginBottom: 4, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24, textAlign: "center" },
  emptyBody: { maxWidth: 260, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
});
