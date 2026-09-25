import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EXPIRY_CHOICES, type CapsForm } from "@/features/session/caps";
import { SESSION } from "./copy";
import { FONT } from "~/theme";
import { tkType, useTk } from "../tk";
import { sessionStyles } from "./Details";
import { useSessionTokens } from "./ModalShell";

function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const tk = useTk();
  const { color } = useSessionTokens();
  return (
    <View style={styles.field}>
      <Text style={[tkType.label, { color: tk.label }]}>{label}</Text>
      {children}
      {hint ? <Text style={[sessionStyles.caption, { color: color.inkMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/** web's `Input` (ui/input): 44 px, rounded-md hairline on the ground, 12 px in, tabular; disabled on surface-2. */
function Input({ value, onChange, disabled, numeric }: { value: string; onChange: (text: string) => void; disabled: boolean; numeric?: boolean }) {
  const { color } = useSessionTokens();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      keyboardType={numeric ? "number-pad" : "decimal-pad"}
      autoComplete="off"
      style={[styles.input, { borderColor: color.hairline, backgroundColor: disabled ? color.surface2 : color.ground, color: disabled ? color.inkDisabled : color.ink }]}
    />
  );
}

/** web's CapsEditor: the caps one field each in the ticket's input grammar, the expiry as the leverage-chip row, the deposit. */
export function CapsEditor({ form, onChange, symbol, disabled }: { form: CapsForm; onChange: (form: CapsForm) => void; symbol: string; disabled: boolean }) {
  const tk = useTk();
  const { color } = useSessionTokens();
  const unit = (text: string) => <Text style={[sessionStyles.caption, { color: color.inkSecondary }]}>{text}</Text>;
  const money = (key: "perTradeText" | "dailyText" | "depositText", label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <View style={styles.inputRow}>
        <Input value={form[key]} disabled={disabled} onChange={(text) => onChange({ ...form, [key]: sanitizeDecimal(text) })} />
        {unit(symbol)}
      </View>
    </Field>
  );
  const whole = (text: string) => Number(text.replace(/\D/g, "") || 0);

  return (
    <View style={styles.editor}>
      <View style={styles.grid}>
        {money("perTradeText", SESSION.sheet.perTrade)}
        {money("dailyText", SESSION.sheet.daily)}
      </View>
      <View style={styles.grid}>
        <Field label={SESSION.sheet.positions}>
          <Input numeric value={String(form.positions)} disabled={disabled} onChange={(text) => onChange({ ...form, positions: whole(text) })} />
        </Field>
        <Field label={SESSION.sheet.price} hint={SESSION.sheet.priceHint}>
          <View style={styles.inputRow}>
            <Input numeric value={String(form.priceCents)} disabled={disabled} onChange={(text) => onChange({ ...form, priceCents: whole(text) })} />
            {unit("¢")}
          </View>
        </Field>
      </View>
      <View style={styles.levRow}>
        <Text style={[tkType.label, { color: tk.label }]}>{SESSION.sheet.expiry}</Text>
        <View style={styles.levs} accessibilityRole="radiogroup" accessibilityLabel={SESSION.sheet.expiry}>
          {EXPIRY_CHOICES.map((choice) => {
            const on = form.expiryHours === choice.hours;
            return (
              <Pressable
                key={choice.hours}
                disabled={disabled}
                onPress={() => onChange({ ...form, expiryHours: choice.hours })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled }}
                style={[styles.chip, { borderColor: on ? tk.levOnBorder : tk.levBorder, backgroundColor: on ? tk.levOnBg : "transparent" }, disabled && styles.dim]}
              >
                <Text style={[tkType.chip, { color: on ? tk.levOnInk : tk.lev }]}>{choice.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {money("depositText", SESSION.sheet.deposit, SESSION.sheet.depositHint)}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 12 },
  grid: { flexDirection: "row", gap: 12 },
  field: { flex: 1, minWidth: 0, gap: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, fontFamily: FONT.body, fontSize: 15, fontVariant: ["tabular-nums"] },
  levRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  levs: { flexDirection: "row", alignItems: "center", gap: 4 },
  chip: { minWidth: 40, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  dim: { opacity: 0.5 },
});
