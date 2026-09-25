import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { useDeskTheme } from "./theme";
import { LinearWash } from "./wash";

/**
 * The desk kit's controls, from web/src/components/ui/desk-kit/primitives.tsx and desk.css / cockpit.css: Underline
 * Tabs (21st #24956), Icon Card Radio Group (#28351), the `.dk-control` pill every card's buttons use and the
 * cockpit toolbar's `.cp-action`.
 */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** web hides the count and the icon at phone width (cockpit.css ≤ 440 / ≤ 560 px); kept for the wider callers. */
  count?: number;
  icon?: ReactNode;
}

/** `.dkit-tabs-list` at 402 px: the tabs share the row, a 2 px accent bar slides under the chosen one. */
export function UnderlineTabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: readonly TabItem<T>[]; label: string }) {
  const { color } = useDeskTheme();
  const reduce = useReducedMotion();
  const [boxes, setBoxes] = useState<Record<string, { x: number; w: number }>>({});
  const left = useSharedValue(0);
  const width = useSharedValue(0);
  const box = boxes[value];
  useEffect(() => {
    if (!box) return;
    left.value = reduce ? box.x : withTiming(box.x, { duration: 260, easing: EASE });
    width.value = reduce ? box.w : withTiming(box.w, { duration: 260, easing: EASE });
  }, [box, reduce, left, width]);
  const bar = useAnimatedStyle(() => ({ left: left.value, width: width.value }));
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.tabs, { borderBottomColor: color.hairline }]}>
      {items.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width: w } = e.nativeEvent.layout;
              setBoxes((b) => (b[t.value]?.x === x && b[t.value]?.w === w ? b : { ...b, [t.value]: { x, w } }));
            }}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(t.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.tab}
          >
            <Text style={[styles.tabText, { color: on ? color.ink : color.inkMuted }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
      {box ? <Animated.View style={[styles.indicator, { backgroundColor: color.accent }, bar]} /> : null}
    </View>
  );
}

export interface RadioCardItem<T extends string> {
  value: T;
  title: ReactNode;
  body?: ReactNode;
  media?: ReactNode;
  footer?: ReactNode;
}

/** `.dkit-radio-cards`: cards that behave as one radio group; one column at phone width (auto-fill, 220 px). */
export function RadioCards<T extends string>({ value, onChange, items, label }: { value: T | null; onChange: (v: T) => void; items: readonly RadioCardItem<T>[]; label: string; columns?: 1 | 2 }) {
  const { color } = useDeskTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.radios}>
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
            accessibilityLabel={typeof item.title === "string" ? item.title : undefined}
            style={[styles.radio, { backgroundColor: color.surface1, borderColor: on ? color.accent : color.hairline }]}
          >
            {on ? <LinearWash from={color.accentWash} until={0.7} radius={13} /> : null}
            {on ? <View pointerEvents="none" style={[styles.ring, { borderColor: color.accent }]} /> : null}
            <View style={[styles.radioDot, { borderColor: on ? color.accent : color.inkMuted }]}>{on ? <View style={[styles.radioDotOn, { backgroundColor: color.accent }]} /> : null}</View>
            {item.media ? <View style={styles.radioMedia}>{item.media}</View> : null}
            {typeof item.title === "string" ? <Text style={[styles.radioTitle, { color: color.ink }]}>{item.title}</Text> : item.title}
            {typeof item.body === "string" ? <Text style={[styles.radioBody, { color: color.inkSecondary }]}>{item.body}</Text> : item.body}
            {item.footer ? <View style={[styles.radioFoot, { borderTopColor: color.hairline }]}>{item.footer}</View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

type ControlTone = "primary" | "danger" | undefined;

/** `.dk-control`: the desk's 40 px pill button; primary is vermilion with the cream ink, danger is the loss ink. */
export function DkControl({ label, onPress, tone, disabled, icon: Icon, locked, style }: { label: string; onPress?: () => void; tone?: ControlTone; disabled?: boolean; icon?: LucideIcon; locked?: boolean; style?: StyleProp<ViewStyle> }) {
  const { color, t } = useDeskTheme();
  const ink = tone === "primary" ? t.controlPrimaryInk : tone === "danger" ? color.loss : locked ? color.inkMuted : color.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.control,
        { borderColor: tone === "primary" ? color.accent : tone === "danger" ? color.loss : pressed ? color.ink : color.hairline, backgroundColor: tone === "primary" ? color.accent : "transparent" },
        locked && styles.dashed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {Icon ? <Icon size={15} color={ink} /> : null}
      <Text style={[styles.controlText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

/** `.cp-action`: the cockpit toolbar's pill (16 px sides, a 15 px icon). */
export function CpAction({ label, onPress, tone, disabled, icon: Icon, accessibilityLabel }: { label: string; onPress?: () => void; tone?: ControlTone; disabled?: boolean; icon?: LucideIcon; accessibilityLabel?: string }) {
  const { color, t } = useDeskTheme();
  const ink = tone === "primary" ? color.onAccent : tone === "danger" ? color.loss : color.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.action,
        { borderColor: tone === "primary" ? color.accent : tone === "danger" ? t.actionDanger : pressed ? color.inkMuted : color.hairline, backgroundColor: tone === "primary" ? (pressed ? color.accentPressed : color.accent) : "transparent" },
        disabled && styles.disabled,
      ]}
    >
      {Icon ? <Icon size={15} color={ink} /> : null}
      <Text style={[styles.controlText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 4, borderBottomWidth: 1 },
  tab: { flexGrow: 1, flexShrink: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 4 },
  tabText: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  indicator: { position: "absolute", bottom: -1, height: 2, borderRadius: 2 },
  radios: { gap: 12 },
  radio: { alignItems: "flex-start", gap: 10, padding: 16, borderWidth: 1, borderRadius: 14 },
  ring: { position: "absolute", top: -2, left: -2, right: -2, bottom: -2, borderWidth: 1, borderRadius: 15 },
  radioDot: { position: "absolute", top: 14, right: 14, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radioDotOn: { width: 8, height: 8, borderRadius: 4 },
  radioMedia: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  radioTitle: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6, letterSpacing: -0.16 },
  radioBody: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.75 },
  radioFoot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, alignSelf: "stretch", paddingTop: 10, borderTopWidth: 1, borderStyle: "dashed" },
  control: { minHeight: 40, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" },
  action: { minHeight: 40, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  controlText: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  dashed: { borderStyle: "dashed" },
  disabled: { opacity: 0.45 },
});
