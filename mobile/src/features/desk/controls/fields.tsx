import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FONT } from "~/theme";
import { useDeskTheme } from "../kit";

/**
 * The money sheet's form pieces, from web's desk.css: `.dk-choice` (a radio card in the accent wash when chosen),
 * `.dk-field` with `.dk-input` (the mono amount box on the page ground) and `.dk-receipt` (label left, figure right).
 */
export function Choice({ title, body, on, onPress }: { title: string; body?: string; on: boolean; onPress: () => void }) {
  const { color } = useDeskTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[styles.choice, on ? { borderColor: color.accent, backgroundColor: color.accentWash } : { borderColor: color.hairline }]}
    >
      <Text style={[styles.choiceTitle, { color: color.ink }]}>{title}</Text>
      {body ? <Text style={[styles.choiceBody, { color: color.inkSecondary }]}>{body}</Text> : null}
    </Pressable>
  );
}

export function AmountInput({ value, onChange, label, placeholder, hideLabel }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; hideLabel?: boolean }) {
  const { color } = useDeskTheme();
  const input = (
    <TextInput
      value={value}
      onChangeText={onChange}
      inputMode="decimal"
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={color.inkMuted}
      accessibilityLabel={label}
      style={[styles.input, { borderColor: color.hairline, backgroundColor: color.ground, color: color.ink }, hideLabel && styles.inline]}
    />
  );
  if (hideLabel) return input;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: color.inkMuted }]}>{label}</Text>
      {input}
    </View>
  );
}

export function Receipt({ rows }: { rows: readonly (readonly [string, string])[] }) {
  const { color } = useDeskTheme();
  return (
    <View style={styles.receipt}>
      {rows.map(([dt, dd]) => (
        <View key={dt} style={styles.receiptRow}>
          <Text style={[styles.receiptText, { color: color.inkMuted }]}>{dt}</Text>
          <Text style={[styles.receiptText, styles.dd, { color: color.ink }]}>{dd}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10 },
  choiceTitle: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  choiceBody: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88, textTransform: "uppercase" },
  input: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, fontFamily: FONT.dataRegular, fontSize: 14 },
  inline: { flexGrow: 1, flexBasis: 120 },
  receipt: { gap: 6 },
  receiptRow: { flexDirection: "row", gap: 16 },
  receiptText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  dd: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
});
