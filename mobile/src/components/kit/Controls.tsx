import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { haptic } from "./haptics";

/** web's pill tabs: one choice of a few, the selected one raised on the track. */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string; count?: number | null }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.track, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: color.surface3, borderColor: color.hairline }]}
          >
            <Text style={[styles.segmentText, { color: on ? color.ink : color.inkSecondary }]} numberOfLines={1}>
              {option.label}
              {option.count != null ? <Text style={{ color: on ? color.accent : color.inkMuted }}> {option.count}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A label/value line in mono numbers; `tone` colours the value (profit, loss, accent). */
export function Row({ label, value, tone, strong, hint }: { label: string; value: ReactNode; tone?: "profit" | "loss" | "accent" | "muted"; strong?: boolean; hint?: string }) {
  const { color } = useTheme();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : tone === "accent" ? color.accent : tone === "muted" ? color.inkMuted : color.ink;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${typeof value === "string" ? value : ""}`}>
      <View style={styles.rowLabel}>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{label}</Text>
        {hint ? <Text style={[TYPE.caption, styles.hint, { color: color.inkMuted }]}>{hint}</Text> : null}
      </View>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={[strong ? TYPE.dataLg : TYPE.data, { color: ink }]} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** A group of Rows between hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return <View style={[styles.rows, { borderColor: color.hairline }]}>{children}</View>;
}

/** A labelled input; numbers get the decimal pad and the mono face. */
export function Field({ label, value, onChangeText, placeholder, numeric, suffix, error, keyboardType, maxLength }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  numeric?: boolean;
  suffix?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: color.surface1, borderColor: error ? color.loss : color.hairline }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.inkMuted}
          keyboardType={keyboardType ?? (numeric ? "decimal-pad" : "default")}
          maxLength={maxLength}
          accessibilityLabel={label}
          style={[styles.input, { color: color.ink, fontFamily: numeric ? FONT.dataStrong : FONT.body }]}
        />
        {suffix ? <Text style={[TYPE.data, { color: color.inkMuted }]}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={[TYPE.caption, { color: color.loss }]}>{error}</Text> : null}
    </View>
  );
}

/** Quick-pick chips ($5 / $10 / Max …). */
export function Chips<T extends string | number>({ options, value, onPick }: { options: readonly { value: T; label: string }[]; value?: T | null; onPick: (value: T) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              haptic.select();
              onPick(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
          >
            <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 3, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  segment: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent", paddingHorizontal: 8 },
  segmentText: { fontFamily: FONT.bodyStrong, fontSize: 13.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34 },
  rowLabel: { flexShrink: 1 },
  hint: { fontSize: 11.5, lineHeight: 15 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  field: { gap: 6 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, minHeight: 50, gap: 8 },
  input: { flex: 1, fontSize: 17, paddingVertical: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
