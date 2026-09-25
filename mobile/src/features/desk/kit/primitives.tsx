import {
  Bell, Check, Circle, CircleDashed, FlaskConical, Gauge, Hand, Hourglass, OctagonAlert, RefreshCw, Rocket, Send, ShieldCheck, Wallet, Wind, type LucideIcon,
} from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { DT, useDeskTheme } from "./theme";

/**
 * The desk kit's small pieces, ported from web/src/components/ui/desk-kit (desk-kit.css): Status Dot (21st #24882),
 * the logo stack (#28355), the titled card every cockpit tab is built from (DeskPanels `Panel`), the eyebrow, the
 * studio's icon tile and the empty state (#1435).
 */
export type DotTone = "live" | "practice" | "warn" | "stopped" | "quiet";
export type LegacyIcon = { ios: string; android: string };

/** Older callers name platform symbols; each maps to the lucide mark web draws in the same place. */
const LEGACY: Record<string, LucideIcon> = {
  flask: FlaskConical, paperplane: Send, "checkmark.shield": ShieldCheck, "gauge.with.dots.needle.50percent": Gauge, wind: Wind,
  "wallet.bifold": Wallet, bell: Bell, hourglass: Hourglass, checkmark: Check, "circle.dashed": CircleDashed, "hand.raised": Hand,
  "exclamationmark.octagon": OctagonAlert, "arrow.triangle.2.circlepath": RefreshCw, rocket: Rocket,
};

export function lucideOf(icon: LucideIcon | LegacyIcon): LucideIcon {
  return typeof icon === "object" && "ios" in icon ? (LEGACY[icon.ios] ?? Circle) : icon;
}

/** `.dkit-status`: a state pill with its dot; "live" pulses (dkit-ping), the rest hold still. */
export function StatusDot({ tone, label, children }: { tone: DotTone; label?: string; children?: ReactNode }) {
  const { color, t } = useDeskTheme();
  const reduce = useReducedMotion();
  const [ink, border, dot] = {
    live: [color.profit, t.statusLive, color.profit],
    practice: [color.accent, color.accentDim, color.accent],
    warn: [color.warning, t.statusWarn, color.warning],
    stopped: [color.loss, t.statusStopped, color.loss],
    quiet: [color.inkSecondary, color.hairline, color.inkMuted],
  }[tone];
  const ping = useSharedValue(0);
  useEffect(() => {
    if (tone === "live" && !reduce) ping.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(0, 0, 0.2, 1) }), -1, false);
  }, [tone, reduce, ping]);
  const ring = useAnimatedStyle(() => ({ opacity: ping.value < 0.75 ? 1 - ping.value / 0.75 : 0, transform: [{ scale: 1 + Math.min(1, ping.value / 0.75) * 1.2 }] }));
  const text = label ?? children;
  return (
    <View style={[styles.status, { borderColor: border }]} accessible accessibilityLabel={typeof text === "string" ? text : undefined}>
      <View style={styles.dotBox}>
        {tone === "live" ? <Animated.View style={[styles.dot, styles.ping, { backgroundColor: dot }, ring]} /> : null}
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
      {typeof text === "string" ? <Text style={[styles.statusText, { color: ink }]} numberOfLines={1}>{text}</Text> : text}
    </View>
  );
}

const LOGO = { sm: 20, md: 28, lg: 36 } as const;

/** `.dkit-logos`: overlapping company marks, each ringed in the card's surface, with a "+N" cell. */
export function LogoStack({ symbols, max = 4, size = "md", names }: { symbols: readonly string[]; max?: number; size?: number | keyof typeof LOGO; names?: readonly string[] }) {
  const { color } = useDeskTheme();
  const px = typeof size === "number" ? size : LOGO[size];
  const shown = symbols.slice(0, max);
  const more = symbols.length - shown.length;
  const cell = (i: number) => ({ width: px + 4, height: px + 4, borderRadius: px, margin: -2, marginLeft: i === 0 ? -2 : -2 - px * 0.3, backgroundColor: color.surface1, zIndex: shown.length - i });
  return (
    <View style={[styles.logos, { marginHorizontal: 2 }]} accessible accessibilityRole="image" accessibilityLabel={(names ?? symbols).join(", ")}>
      {shown.map((s, i) => (
        <View key={s} style={[styles.logoRing, cell(i)]}>
          <View style={{ width: px, height: px, borderRadius: px, overflow: "hidden", backgroundColor: color.surface2 }}>
            <AssetDisc asset={s} size={px} />
          </View>
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.logoRing, cell(shown.length), { zIndex: 0 }]}>
          <View style={[styles.more, { width: px, height: px, borderRadius: px, backgroundColor: color.surface2 }]}>
            <Text style={[styles.moreText, { color: color.ink, fontSize: px * 0.36 }]}>+{more}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** `.st-icon-tile`: a 40 px rounded square, tinted by level. Takes a lucide mark (or an older platform symbol). */
export function IconTile({ icon, level }: { icon: LucideIcon | LegacyIcon; level?: "careful" | "balanced" | "loose" }) {
  const { color, t } = useDeskTheme();
  const Icon = lucideOf(icon);
  const [bg, ink] =
    level === "careful" ? [color.profitWash, color.profit] : level === "balanced" ? [color.accentWash, color.accent] : level === "loose" ? [t.badgeAsked, color.warning] : [color.surface2, color.inkSecondary];
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Icon size={20} color={ink} />
    </View>
  );
}

/** web's DeskPanels `Panel` (`.cp-card` with `.dk-panel-head`): a titled card; `aside` sits on the title's baseline. */
export function Panel({ title, aside, children, borderColor }: { title: string; aside?: ReactNode; children: ReactNode; borderColor?: string }) {
  const { color } = useDeskTheme();
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: borderColor ?? color.hairline }]} accessibilityLabel={title}>
      <View style={styles.panelHead}>
        <Text style={[DT.panelTitle, { color: color.inkMuted }]} accessibilityRole="header">
          {title}
        </Text>
        {typeof aside === "string" ? <Text style={[DT.caption, { color: color.inkMuted }]}>{aside}</Text> : aside}
      </View>
      {children}
    </View>
  );
}

/** `.dk-eyebrow`: the mono caps line naming whose desk and which network; a live desk's reads in the accent. */
export function Eyebrow({ text, live }: { text: string; live?: boolean }) {
  const { color } = useDeskTheme();
  return <Text style={[DT.eyebrow, { color: live ? color.accent : color.inkMuted }]}>{text}</Text>;
}

/** `.dkit-empty`: a calm empty state, a mark in a tile, a line, a sentence and an optional action. */
export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  const { color } = useDeskTheme();
  return (
    <View style={[styles.empty, { borderColor: color.hairline }]}>
      <View style={[styles.emptyIcon, { backgroundColor: color.surface2 }]}>
        <Icon size={24} color={color.inkSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: color.ink }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: color.inkSecondary }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderWidth: 1, borderRadius: 9999, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 10 },
  dotBox: { width: 8, height: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ping: { position: "absolute" },
  statusText: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66, textTransform: "uppercase" },
  logos: { flexDirection: "row", alignItems: "center" },
  logoRing: { alignItems: "center", justifyContent: "center" },
  more: { alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: FONT.bodyStrong },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  panelHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 16, borderWidth: 1, borderStyle: "dashed", borderRadius: 14 },
  emptyIcon: { width: 48, height: 48, marginBottom: 4, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24, textAlign: "center" },
  emptyBody: { maxWidth: 260, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
});
