import { AlertCircle, Check } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { FONT } from "~/theme";
import { KeepCase, useEarnParlay } from "~/features/earn/EarnKit";
import { Rise, Spinner } from "./ParlayKit";

/** web's ticket `Row` (`features/parlay/TicketParts.tsx`, `.pl-row`). */
export function Row({ label, children, emphasize, accent }: { label: string; children: ReactNode; emphasize?: boolean; accent?: boolean }) {
  const { color, t } = useEarnParlay();
  const ink = accent ? color.accent : emphasize ? color.ink : t.gray300;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowVal, (emphasize || accent) && styles.rowValBig, { color: ink }]}>{children}</Text>
    </View>
  );
}

/** web's `AmountField`: a decimal input with the unit pinned at its right edge. */
export function AmountField({ label, value, onChange, hint, symbol }: { label: string; value: string; onChange: (v: string) => void; hint?: string; symbol: string }) {
  const { color, t } = useEarnParlay();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View style={styles.fieldHead}>
        <Text style={[styles.fieldLabel, { color: color.inkMuted }]}>{label}</Text>
        {hint ? <Text style={[styles.fieldHint, { color: color.inkDisabled }]}>{hint}</Text> : null}
      </View>
      <View>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="0.00"
          placeholderTextColor={t.placeholder}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={color.accent}
          style={[styles.input, { color: color.ink, backgroundColor: t.inputBg, borderColor: focused ? t.inputFocus : t.inputBorder }]}
        />
        <Text style={[styles.unit, { color: color.inkMuted }]} pointerEvents="none">
          {symbol}
        </Text>
      </View>
    </View>
  );
}

export type PlaceStep = "idle" | "placing" | "success" | "error";

interface PlaceButtonProps {
  step: PlaceStep;
  quoted: boolean;
  quoteLoading: boolean;
  quoteError: boolean;
  hasEnough: boolean;
  stakeText: string;
  symbol: string;
  onPlace: () => void;
}

/** web's `PlaceButton`: the place control's ladder in the reference's order; the wallet prompt is the confirmation. */
export function PlaceButton({ step, quoted, quoteLoading, quoteError, hasEnough, stakeText, symbol, onPlace }: PlaceButtonProps) {
  const { color, t } = useEarnParlay();
  const ticket = PARLAY.ticket;
  const disabled = !quoted || quoteLoading || quoteError || !hasEnough || step === "placing" || step === "success";
  const muted = (!quoted || !hasEnough) && step === "idle";
  const ink = muted ? color.inkSecondary : color.onAccent;
  const label = (text: ReactNode) => <Text style={[styles.placeText, { color: ink }]}>{text}</Text>;
  return (
    <Pressable
      onPress={onPlace}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.place,
        muted
          ? { backgroundColor: t.placeMutedBg, borderColor: t.toggleBorder, borderWidth: 1 }
          : { backgroundColor: pressed ? color.accentPressed : color.accent, boxShadow: t.placeGlow, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {step === "placing" ? (
        <View style={styles.placeInner}>
          <Spinner size={16} color={ink} />
          {label(ticket.placing)}
        </View>
      ) : step === "success" ? (
        <View style={styles.placeInner}>
          <Check size={16} color={ink} />
          {label(ticket.placed)}
        </View>
      ) : quoteLoading ? (
        label(ticket.pricing)
      ) : quoteError ? (
        label(ticket.unavailable)
      ) : !quoted ? (
        label(ticket.build)
      ) : !hasEnough ? (
        label(<KeepCase text={ticket.insufficient(symbol)} symbol={symbol} />)
      ) : (
        label(<KeepCase text={ticket.place(stakeText, symbol)} symbol={symbol} />)
      )}
    </Pressable>
  );
}

/** web's `ErrorBlock`: a headline, the technical detail behind a disclosure, and a way back. */
export function ErrorBlock({ title, detail, onReset }: { title: string; detail: string; onReset: () => void }) {
  const { color, t } = useEarnParlay();
  const [open, setOpen] = useState(false);
  const words = PARLAY.ticket;
  return (
    <Rise drop style={[styles.err, { backgroundColor: t.errBg, borderColor: t.errBorder }]}>
      <View style={styles.errIcon}>
        <AlertCircle size={16} color={color.loss} />
      </View>
      <View style={styles.errBody} accessibilityRole="alert">
        <Text style={[styles.errTitle, { color: color.loss }]}>{title}</Text>
        {detail && detail !== title ? (
          <View style={styles.errDetails}>
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
              <Text style={[styles.errSummary, { color: t.loss50 }]}>
                {open ? "▾" : "▸"} {words.technical}
              </Text>
            </Pressable>
            {open ? (
              <ScrollView style={styles.errDetailBox} nestedScrollEnabled>
                <Text style={[styles.errDetail, { color: t.loss60 }]}>{detail}</Text>
              </ScrollView>
            ) : null}
          </View>
        ) : null}
        <Pressable onPress={onReset} accessibilityRole="button" hitSlop={6}>
          <Text style={[styles.errRetry, { color: color.loss }]}>{words.tryAgain}</Text>
        </Pressable>
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  rowVal: { fontFamily: FONT.dataStrong, fontSize: 14, lineHeight: 21, fontVariant: ["tabular-nums"] },
  rowValBig: { fontSize: 16, lineHeight: 24 },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  fieldLabel: { fontFamily: FONT.bodyStrong, fontSize: 10, lineHeight: 15, letterSpacing: 2, textTransform: "uppercase" },
  fieldHint: { fontFamily: FONT.body, fontSize: 10, lineHeight: 15 },
  input: { paddingVertical: 10, paddingHorizontal: 12, paddingRight: 64, borderRadius: 12, borderWidth: 1, fontFamily: FONT.dataRegular, fontSize: 18, lineHeight: 26, height: 48 },
  unit: { position: "absolute", right: 12, top: 0, bottom: 0, textAlignVertical: "center", lineHeight: 48, fontFamily: FONT.bodyStrong, fontSize: 12 },
  place: { width: "100%", paddingVertical: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  placeInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  placeText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20, letterSpacing: 0.7, textTransform: "uppercase" },
  err: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  errIcon: { marginTop: 2 },
  errBody: { flex: 1, minWidth: 0 },
  errTitle: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 18 },
  errDetails: { marginTop: 4 },
  errSummary: { fontFamily: FONT.body, fontSize: 10, lineHeight: 15 },
  errDetailBox: { maxHeight: 96, marginTop: 4 },
  errDetail: { fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5 },
  errRetry: { marginTop: 4, fontFamily: FONT.body, fontSize: 10, lineHeight: 15, textDecorationLine: "underline" },
});
