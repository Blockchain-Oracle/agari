import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's copy-form field (CopyFormFields' Field): a mono amount with its unit, a Max that fills the most this form can
 * take, and the field's own red line. Only digits and one dot are kept.
 */
export function AmountInput({ label, symbol, value, onChange, error, disabled, onMax, maxDisabled, hint }: {
  label: string;
  symbol: string;
  value: string;
  onChange: (text: string) => void;
  error?: string | null;
  disabled?: boolean;
  onMax?: () => void;
  maxDisabled?: boolean;
  hint?: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>
        {label} · {symbol}
      </Text>
      <View style={[styles.row, { backgroundColor: color.surface1, borderColor: error ? color.loss : color.hairline, opacity: disabled ? 0.55 : 1 }]}>
        <TextInput
          value={value}
          editable={!disabled}
          onChangeText={(text) => onChange(text.replace(",", ".").replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={color.inkMuted}
          accessibilityLabel={`${label} in ${symbol}`}
          style={[styles.input, { color: color.ink }]}
        />
        <Text style={[TYPE.data, { color: color.inkMuted }]}>{symbol}</Text>
        {onMax ? (
          <Pressable
            onPress={() => {
              haptic.select();
              onMax();
            }}
            disabled={disabled || maxDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Max ${label}`}
            style={[styles.max, { borderColor: color.borderStrong, opacity: disabled || maxDisabled ? 0.4 : 1 }]}
          >
            <Text style={[TYPE.labelMicro, { color: color.ink }]}>Max</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[TYPE.caption, { color: color.loss }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: RADIUS.md, paddingLeft: 14, paddingRight: 6, minHeight: 52 },
  input: { flex: 1, fontFamily: FONT.dataStrong, fontSize: 20, paddingVertical: 10 },
  max: { minHeight: 40, minWidth: 52, paddingHorizontal: 10, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
