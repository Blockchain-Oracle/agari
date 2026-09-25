import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT, useTheme } from "~/theme";
import { strategiesTokens } from "~/theme/web/products/strategies";

/** This family's theme: the app palette plus the strategies page's own web values. */
export function useStrat() {
  const { name, color } = useTheme();
  return { name, color, t: strategiesTokens(name) };
}

/** web's mono runs: JetBrains Mono 400 at the browser's 1.6 line, letter-spacing in em. */
const mono = (size: number, em = 0, upper = false): TextStyle => ({
  fontFamily: FONT.dataRegular,
  fontSize: size,
  lineHeight: size * 1.6,
  letterSpacing: em * size,
  ...(upper ? { textTransform: "uppercase" as const } : null),
});

/** strategies.css / desk.css / builder.css type, colour applied at the call site. */
export const ST = StyleSheet.create({
  meta: mono(10, 0.14, true),
  micro: mono(9, 0.18, true),
  rail: mono(11, 0.22, true),
  mono10: mono(10),
  mono11: mono(11),
  mono12: mono(12),
  deskEyebrow: mono(9, 0.18, true),
  deskStatus: mono(10, 0.18, true),
  deskNote: mono(10),
  deskFine: mono(9),
  h1: { fontFamily: FONT.headingHeavy, fontSize: 28.5, lineHeight: 28.5, letterSpacing: -0.7125 },
  h2: { fontFamily: FONT.headingHeavy, fontSize: 19, lineHeight: 30.4, letterSpacing: -0.475 },
  choiceTitle: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  choiceBody: { fontFamily: FONT.body, fontSize: 12, lineHeight: 16.5 },
  drawerBody: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17.1875 },
  textSm: { fontFamily: FONT.body, fontSize: 13.125, lineHeight: 18.75 },
  textSmRelaxed: { fontFamily: FONT.body, fontSize: 13.125, lineHeight: 21.3281 },
  textXs: { fontFamily: FONT.body, fontSize: 11.25, lineHeight: 15.4688 },
  fieldLabel: { fontFamily: FONT.bodyStrong, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
});

interface PressProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** desk.css `.desk-pill` (and `--on`): the mono uppercase pill. */
export function DeskPill({ label, onPress, disabled, on, style }: PressProps & { on?: boolean }) {
  const { t } = useStrat();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.pill, { borderColor: on ? t.vermilionA(0.6) : t.ink(0.15), opacity: disabled ? 0.45 : 1 }, style]}
    >
      <Text style={[ST.mono11, styles.pillText, { color: on ? t.vermilion : t.gray300 }]}>{label}</Text>
    </Pressable>
  );
}

/** `.desk-btn-primary`: the vermilion pill; `blocked` is copy-form.css's aria-disabled look that still takes the press. */
export function PrimaryButton({ label, onPress, disabled, blocked, block, style }: PressProps & { blocked?: boolean; block?: boolean }) {
  const { t } = useStrat();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || blocked) }}
      style={({ pressed }) => [
        styles.primary,
        block ? styles.block : styles.shrink,
        { backgroundColor: pressed ? t.vermilionD : t.vermilion, opacity: disabled ? 0.45 : blocked ? 0.55 : 1 },
        style,
      ]}
    >
      <Text style={[styles.primaryText, { color: t.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

/** builder.css `.strat-confirm` — `live` glows, `dead` is the quiet disabled fill. */
export function Confirm({ label, onPress, disabled, live, style }: PressProps & { live: boolean }) {
  const { t, color } = useStrat();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.confirm, live ? { backgroundColor: t.vermilion, boxShadow: t.confirmShadow } : { backgroundColor: t.ink(0.07) }, style]}
    >
      <Text style={[styles.confirmText, { color: live ? t.onAccent : color.inkSecondary }]}>{label}</Text>
    </Pressable>
  );
}

/** `.strat-sensei`: the vermilion-wash rounded link button. */
export function Sensei({ label, onPress, disabled, style }: PressProps) {
  const { t } = useStrat();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.sensei, { borderColor: t.vermilionA(0.4), backgroundColor: t.vermilionA(0.07), opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Text style={[styles.senseiText, { color: t.vermilion }]}>{label}</Text>
    </Pressable>
  );
}

/** web's wallet ConnectButton on a phone: the accent button that opens the wallet sheet. */
export function ConnectButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const session = useWalletSession();
  const { t, color } = useStrat();
  return (
    <Pressable
      onPress={session.connect}
      accessibilityRole="button"
      style={({ pressed }) => [styles.connect, { backgroundColor: pressed ? color.accentPressed : color.accent }, style]}
    >
      <Text style={[styles.connectText, { color: t.onAccent }]}>{CONNECT.connect}</Text>
    </Pressable>
  );
}

/** `.strat-input`: the quiet mono field (`multiline` is `.strat-textarea`). */
export function StratInput({ style, invalid, ...props }: TextInputProps & { invalid?: boolean }) {
  const { t, color } = useStrat();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={color.inkMuted}
      {...props}
      onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
      style={[
        styles.input,
        props.multiline && styles.textarea,
        { color: color.ink, backgroundColor: t.ink(0.03), borderColor: invalid ? color.loss : focus ? t.ink(0.2) : t.ink(0.08) },
        invalid && { boxShadow: `0px 0px 0px 3px ${color.lossWash}` },
        props.editable === false && { opacity: 0.6 },
        style,
      ]}
    />
  );
}

/** desk.css `.desk-field-label`. */
export function FieldLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { color } = useStrat();
  return <Text style={[ST.fieldLabel, { color: color.inkMuted }, style]}>{children}</Text>;
}

/** A `<details>`: the summary line with its disclosure marker, the body under it once opened. */
export function Details({ summary, summaryStyle, children, style }: { summary: string; summaryStyle?: StyleProp<TextStyle>; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6}>
        <Text style={summaryStyle}>
          {open ? "▾" : "▸"} {summary}
        </Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: 9999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  pillText: { textTransform: "uppercase", letterSpacing: 1.32 },
  primary: { borderRadius: 9999, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center" },
  block: { alignSelf: "stretch" },
  shrink: { alignSelf: "flex-start" },
  primaryText: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  confirm: { borderRadius: 9999, paddingVertical: 12, alignItems: "center" },
  confirmText: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24 },
  sensei: { alignSelf: "flex-start", borderRadius: 9999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  senseiText: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 20 },
  connect: { alignSelf: "flex-start", height: 48, borderRadius: 8, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  connectText: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  input: { borderWidth: 1, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, minHeight: 37 },
  textarea: { minHeight: 96, textAlignVertical: "top" },
});
