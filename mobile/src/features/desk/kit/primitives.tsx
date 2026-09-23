import { SymbolView } from "expo-symbols";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/**
 * The desk kit's small pieces, from web/src/components/ui/desk-kit/primitives.tsx and charts.tsx: Status Dot
 * (21st #24882), Avatar Stack as a logo stack (#28355), Icon Card Radio Group (#28351), Underline Tabs (#24956) and
 * the titled panel every cockpit tab is built from.
 */
export type DotTone = "live" | "practice" | "warn" | "stopped" | "quiet";

/** A state pill with its dot; "live" pulses, the rest hold still. */
export function StatusDot({ tone, label }: { tone: DotTone; label: string }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const ink = { live: color.profit, practice: color.accent, warn: color.warning, stopped: color.loss, quiet: color.inkMuted }[tone];
  const ping = useSharedValue(0);
  useEffect(() => {
    if (tone === "live" && !reduce) ping.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
  }, [tone, reduce, ping]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 1.4 }] }));
  return (
    <View style={[styles.status, { borderColor: ink }]} accessible accessibilityLabel={label}>
      <View style={styles.dotWrap}>
        {tone === "live" ? <Animated.View style={[styles.dot, styles.ping, { backgroundColor: ink }, ring]} /> : null}
        <View style={[styles.dot, { backgroundColor: ink }]} />
      </View>
      <Text style={[styles.statusText, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Overlapping company marks with a "+N" cell. */
export function LogoStack({ symbols, max = 4, size = 22, names }: { symbols: readonly string[]; max?: number; size?: number; names?: readonly string[] }) {
  const { color } = useTheme();
  const shown = symbols.slice(0, max);
  const more = symbols.length - shown.length;
  return (
    <View style={styles.logos} accessible accessibilityRole="image" accessibilityLabel={(names ?? symbols).join(", ")}>
      {shown.map((s, i) => (
        <View key={s} style={[styles.logo, { marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: shown.length - i, borderColor: color.ground, borderRadius: size }]}>
          <AssetDisc asset={s} size={size} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.more, { width: size + 4, height: size + 4, borderRadius: size, marginLeft: -size * 0.3, backgroundColor: color.surface2, borderColor: color.ground }]}>
          <Text style={[styles.moreText, { color: color.inkSecondary, fontSize: size * 0.42 }]}>+{more}</Text>
        </View>
      ) : null}
    </View>
  );
}

export interface RadioCardItem<T extends string> {
  value: T;
  title: string;
  body?: ReactNode;
  media?: ReactNode;
  footer?: ReactNode;
}

/** Cards that behave as one radio group; the media slot takes logos or an icon tile. */
export function RadioCards<T extends string>({ value, onChange, items, label, columns = 1 }: { value: T | null; onChange: (v: T) => void; items: readonly RadioCardItem<T>[]; label: string; columns?: 1 | 2 }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.radios, columns === 2 && styles.radiosTwo]}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => {
              haptic.select();
              onChange(item.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={item.title}
            style={({ pressed }) => [
              styles.radio,
              columns === 2 && styles.radioHalf,
              { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.radioHead}>
              {item.media ? <View style={styles.radioMedia}>{item.media}</View> : null}
              <View style={[styles.radioDot, { borderColor: on ? color.accent : color.borderStrong }]}>
                {on ? <View style={[styles.radioDotOn, { backgroundColor: color.accent }]} /> : null}
              </View>
            </View>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{item.title}</Text>
            {typeof item.body === "string" ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{item.body}</Text> : item.body}
            {item.footer ? <View style={styles.radioFoot}>{item.footer}</View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A square icon tile for a radio card (web's `.st-icon-tile`), tinted by level. */
export function IconTile({ icon, level }: { icon: { ios: string; android: string }; level: "careful" | "balanced" | "loose" }) {
  const { color } = useTheme();
  const ink = level === "careful" ? color.profit : level === "balanced" ? color.accent : color.warning;
  const wash = level === "careful" ? color.profitWash : level === "balanced" ? color.accentWash : color.surface2;
  return (
    <View style={[styles.tile, { backgroundColor: wash }]}>
      <SymbolView name={icon as never} size={20} tintColor={ink} />
    </View>
  );
}

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Underline tabs that scroll sideways on a small phone; the accent bar sits under the chosen one. */
export function UnderlineTabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: readonly TabItem<T>[]; label: string }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.tabs, { borderBottomColor: color.hairline }]}>
      {items.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(t.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.tab, { borderBottomColor: on ? color.accent : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: on ? color.ink : color.inkSecondary }]} numberOfLines={1}>
              {t.label}
            </Text>
            {t.count !== undefined ? <Text style={[TYPE.data, styles.tabCount, { color: on ? color.accent : color.inkMuted }]}>{t.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A titled card (web's DeskPanels `Panel`). */
export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={title}>
      <View style={styles.panelHead}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} accessibilityRole="header">
          {title}
        </Text>
        {typeof aside === "string" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{aside}</Text> : aside}
      </View>
      {children}
    </View>
  );
}

/** web's `.dk-eyebrow`: the mono caps line naming whose desk and which network; live desks read in the profit ink. */
export function Eyebrow({ text, live }: { text: string; live?: boolean }) {
  const { color } = useTheme();
  return <Text style={[styles.eyebrow, { color: live ? color.profit : color.accent }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 9, height: 24 },
  dotWrap: { width: 7, height: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  ping: { position: "absolute" },
  statusText: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 0.4 },
  logos: { flexDirection: "row", alignItems: "center" },
  logo: { borderWidth: 2 },
  more: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
  moreText: { fontFamily: FONT.dataStrong },
  radios: { gap: 10 },
  radiosTwo: { flexDirection: "row", flexWrap: "wrap" },
  radio: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 6, minHeight: 44 },
  radioHalf: { flexBasis: "47%", flexGrow: 1 },
  pressed: { opacity: 0.86 },
  radioHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  radioMedia: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  radioDotOn: { width: 10, height: 10, borderRadius: 5 },
  radioFoot: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  tile: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderBottomWidth: 2, paddingHorizontal: 2 },
  tabText: { fontFamily: FONT.bodyStrong, fontSize: 13.5 },
  tabCount: { fontSize: 11 },
  panel: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.4 },
});
