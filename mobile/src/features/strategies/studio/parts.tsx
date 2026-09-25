import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT } from "~/theme";
import { FieldLabel, ST, useStrat } from "../ui";

/** A new portrait seed, as web's `crypto.randomUUID()`. */
export function newPortraitSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `agari-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** web StudioForm `Field`: the desk field label over its control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  );
}

/** strategies.css `.strat-choice` (and `--on`): the bordered approach / hosting card. */
export function Choice({ title, body, on, disabled, onPress }: { title: string; body: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  const { t, color } = useStrat();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={[styles.choice, on ? { borderColor: t.vermilion, backgroundColor: t.vermilionA(0.06) } : { borderColor: t.ink(0.08) }, disabled && styles.off]}
    >
      <Text style={[ST.choiceTitle, { color: color.ink }]}>{title}</Text>
      <Text style={[ST.choiceBody, styles.mt8, { color: color.inkSecondary }]}>{body}</Text>
    </Pressable>
  );
}

/** strategies.css `.strat-chip` (and `--on`): a flex-1 mono option. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { t } = useStrat();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on ? { borderColor: t.vermilion, backgroundColor: t.vermilionA(0.06) } : { borderColor: t.ink(0.08) }]}
    >
      <Text style={[styles.chipText, { color: on ? t.vermilion : t.ink(0.5) }]}>{label}</Text>
    </Pressable>
  );
}

/** web's strat-choice-body paragraph. */
export function Body({ children, style }: { children: ReactNode; style?: object }) {
  const { color } = useStrat();
  return <Text style={[ST.choiceBody, { color: color.inkSecondary }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  choice: { borderRadius: 12, borderWidth: 1, padding: 16 },
  off: { opacity: 0.6 },
  mt8: { marginTop: 8 },
  chip: { flexGrow: 1, flexBasis: 0, paddingVertical: 6, borderRadius: 4, borderWidth: 1, alignItems: "center" },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});
