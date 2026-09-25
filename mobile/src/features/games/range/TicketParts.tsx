import { SETTLING } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import type { Signature } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { AlertCircle, Check, Loader2 } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import type { SolveMode } from "@/features/range/RangeTicket";
import { Press } from "~/features/games/frame";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { useRangeTokens } from "./PageParts";

/** web's parlay `TicketParts` step ladder, as the reserve tickets use it. */
export type PlaceStep = "idle" | "placing" | "success" | "error";

/** A decimal typed into a money field: digits and one point. */
export function sanitizeAmount(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

/** lucide's Loader2 turning (`animate-spin`). */
export function Spinner({ size, color }: { size: number; color: string }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={spin}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

/** web's `components/data/Countdown`: the chain-corrected clock to a Window's close, "settling" at zero, accent once urgent. */
export function Clock({ expirySec, intervalSec, nowMs, style }: { expirySec: number; intervalSec: number; nowMs: number; style?: StyleProp<TextStyle> }) {
  const { color } = useRangeTokens();
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  return (
    <Text style={[style, styles.numbers, state?.urgent && { color: color.accent }]} accessibilityRole="timer">
      {state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : "–:––"}
    </Text>
  );
}

/** web's `KeepCase`: an uppercase label that leaves the token symbol as it is spelled. */
export function keepCase(text: string, symbol: string): string {
  return text
    .split(symbol)
    .map((part) => part.toUpperCase())
    .join(symbol);
}

/** `.pl-ticket`: the plate, its head (title and mono tag) and the 20 px body. */
export function TicketFrame({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  const { t, r, color } = useRangeTokens();
  return (
    <View style={[styles.ticket, { borderColor: t.cardBorder, backgroundColor: r.plate }]}>
      <View style={[styles.ticketHead, { borderBottomColor: r.headRule }]}>
        <Text style={[styles.ticketTitle, { color: color.ink }]}>{title}</Text>
        <Text style={[styles.ticketTag, { color: color.inkDisabled }]}>{tag.toUpperCase()}</Text>
      </View>
      <View style={styles.ticketBody}>{children}</View>
    </View>
  );
}

/** `.pl-need2`: what the ticket needs before it can price. */
export function Need({ children }: { children: string }) {
  const { color } = useRangeTokens();
  return <Text style={[styles.need, { color: color.inkMuted }]}>{children}</Text>;
}

/** `.pl-pays`: the contract's multiple, the spinner while pricing, the odds line under it. */
export function Pays({ label, multiple, sub, loading }: { label: string; multiple: string | null; sub: string | null; loading: boolean }) {
  const { r, color } = useRangeTokens();
  return (
    <View style={styles.pays} accessibilityLiveRegion="polite">
      <Text style={[styles.paysLabel, { color: color.inkDisabled }]}>{label.toUpperCase()}</Text>
      <View style={styles.paysX}>{loading ? <Spinner size={36} color={r.spin} /> : <Text style={[styles.paysXText, { color: color.accent }]}>{multiple ?? "···"}</Text>}</View>
      {sub && !loading ? <Text style={[styles.paysSub, { color: color.inkMuted }]}>{sub}</Text> : null}
    </View>
  );
}

/** `.pl-solver`: the two solve modes, the amount field and the pay / win rows. */
export function Solver({ labels, solveMode, onSolveMode, children }: { labels: { setStake: string; setPayout: string }; solveMode: SolveMode; onSolveMode: (m: SolveMode) => void; children: ReactNode }) {
  const { r, color } = useRangeTokens();
  const mode = (value: SolveMode, label: string) => {
    const on = solveMode === value;
    return (
      <Pressable key={value} onPress={() => onSolveMode(value)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.mode, on && { backgroundColor: r.modeOnBg }]}>
        <Text style={[styles.modeText, { color: on ? color.accent : color.inkMuted }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.solver, { backgroundColor: r.solverBg, borderColor: r.solverBorder }]}>
      <View style={[styles.modes, { borderColor: r.modesBorder }]}>
        {mode("fixStake", labels.setStake)}
        {mode("fixPayout", labels.setPayout)}
      </View>
      {children}
    </View>
  );
}

/** The ticket's `AmountField`: a decimal input with the unit pinned at its right edge, a hint beside the label. */
export function AmountField({ label, value, onChange, hint, symbol }: { label: string; value: string; onChange: (v: string) => void; hint?: string; symbol: string }) {
  const { r, color } = useRangeTokens();
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <View style={styles.fieldHead}>
        <Text style={[styles.fieldLabel, { color: color.inkMuted }]}>{label.toUpperCase()}</Text>
        {hint ? <Text style={[styles.fieldHint, { color: color.inkDisabled }]}>{hint}</Text> : null}
      </View>
      <View>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(sanitizeAmount(text))}
          placeholder="0.00"
          placeholderTextColor={color.inkDisabled}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[styles.input, { backgroundColor: r.inputBg, borderColor: focus ? r.inputFocus : r.inputBorder, color: color.ink }]}
        />
        <Text style={[styles.unit, { color: color.inkMuted }]} pointerEvents="none">
          {symbol}
        </Text>
      </View>
    </View>
  );
}

/** The ticket's `Row`: a gray label and a mono figure — white and larger when emphasised, vermilion as the accent. */
export function Row({ label, children, emphasize, accent }: { label: string; children: string; emphasize?: boolean; accent?: boolean }) {
  const { r, color } = useRangeTokens();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowVal, { color: r.gray300 }, emphasize && [styles.rowBig, { color: color.ink }], accent && [styles.rowBig, { color: color.accent }]]}>{children}</Text>
    </View>
  );
}

/** `.pl-profit`: the profit line under the rows, right-aligned. */
export function Profit({ children }: { children: string | null }) {
  const { color } = useRangeTokens();
  return <Text style={[styles.profit, { color: color.inkDisabled }]}>{children ?? ""}</Text>;
}

/** `.pl-quote-err`: a refusal or failed quote in the loss colour, underlined; a tap is its remedy. */
export function QuoteErr({ children, onPress }: { children: string; onPress?: () => void }) {
  const { r } = useRangeTokens();
  const text = <Text style={[styles.quoteErr, { color: r.lossSoft }]}>{children}</Text>;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {text}
    </Pressable>
  ) : (
    text
  );
}

export interface PlaceLabels {
  placing: string;
  placed: string;
  pricing: string;
  unavailable: string;
  insufficient: (symbol: string) => string;
  place: (stake: string, symbol: string) => string;
  build: string;
}

/** The place control's ladder (`PlaceButton`): placing, placed, pricing, unavailable, build, short, place. */
export function PlaceButton({ step, quoted, quoteLoading, quoteError, hasEnough, stakeText, symbol, onPlace, labels }: { step: PlaceStep; quoted: boolean; quoteLoading: boolean; quoteError: boolean; hasEnough: boolean; stakeText: string; symbol: string; onPlace: () => void; labels: PlaceLabels }) {
  const { r, color } = useRangeTokens();
  const disabled = !quoted || quoteLoading || quoteError || !hasEnough || step === "placing" || step === "success";
  const muted = (!quoted || !hasEnough) && step === "idle";
  const ink = muted ? color.inkSecondary : r.placeInk;
  const label =
    step === "placing" ? labels.placing : step === "success" ? labels.placed : quoteLoading ? labels.pricing : quoteError ? labels.unavailable : !quoted ? labels.build : !hasEnough ? labels.insufficient(symbol) : labels.place(stakeText, symbol);
  return (
    <Press
      onPress={onPlace}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: step === "placing" }}
      style={[
        styles.place,
        muted ? { backgroundColor: r.placeMutedBg, borderColor: r.placeMutedBorder } : [styles.placeGlow, { backgroundColor: color.accent, shadowColor: r.placeGlow }],
        disabled && !muted && styles.placeOff,
      ]}
    >
      <View style={styles.placeInner}>
        {step === "placing" ? <Spinner size={16} color={ink} /> : step === "success" ? <Check size={16} color={ink} /> : null}
        <Text style={[styles.placeText, { color: ink }]}>{keepCase(label, symbol)}</Text>
      </View>
    </Press>
  );
}

/** `.pl-footnote`: the settlement line and the reserve's own state. */
export function Footnote({ lines }: { lines: string[] }) {
  const { color } = useRangeTokens();
  return <Text style={[styles.footnote, { color: color.inkDisabled }]}>{lines.join("\n")}</Text>;
}

/** web's `ErrorBlock`: the headline, the technical detail behind a disclosure, and a way back. */
export function ErrorBlock({ title, detail, onReset, labels }: { title: string; detail: string; onReset: () => void; labels: { technical: string; tryAgain: string } }) {
  const { r, color } = useRangeTokens();
  const [open, setOpen] = useState(false);
  return (
    <View accessibilityRole="alert" style={[styles.err, { backgroundColor: r.errBg, borderColor: r.errBorder }]}>
      <AlertCircle size={16} color={color.loss} style={styles.errIcon} />
      <View style={styles.errBody}>
        <Text style={[styles.errTitle, { color: color.loss }]}>{title}</Text>
        {detail && detail !== title ? (
          <>
            <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" hitSlop={6}>
              <Text style={[styles.errSummary, { color: r.lossHalf }]}>
                {open ? "▾" : "▸"} {labels.technical}
              </Text>
            </Pressable>
            {open ? (
              <Text style={[styles.errDetail, { color: r.lossDim }]} selectable>
                {detail}
              </Text>
            ) : null}
          </>
        ) : null}
        <Pressable onPress={onReset} accessibilityRole="button" hitSlop={6}>
          <Text style={[styles.errRetry, { color: color.loss }]}>{labels.tryAgain}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** `.pl-txlink`: the confirmed transaction on the explorer. */
export function TxLink({ txHash, label }: { txHash: Signature; label: string }) {
  const { r } = useRangeTokens();
  return (
    <Pressable onPress={() => void openExternal(txUrl(txHash))} accessibilityRole="link">
      <Text style={[styles.txLink, { color: r.txLink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  numbers: { fontVariant: ["tabular-nums"] },
  ticket: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  ticketHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  ticketTitle: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 20, letterSpacing: 0.35 },
  ticketTag: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 1.62 },
  ticketBody: { padding: 20, gap: 16 },
  need: { paddingVertical: 24, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5, textAlign: "center" },
  pays: { alignItems: "center", paddingVertical: 8 },
  paysLabel: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.8 },
  paysX: { minHeight: 48, justifyContent: "center" },
  paysXText: { fontFamily: FONT.headingHeavy, fontSize: 48, lineHeight: 52, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
  paysSub: { marginTop: 8, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, textAlign: "center" },
  solver: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  modes: { flexDirection: "row", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  mode: { flex: 1, paddingVertical: 6, alignItems: "center" },
  modeText: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 17.6 },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  fieldLabel: { fontFamily: FONT.bodyStrong, fontSize: 10, letterSpacing: 2 },
  fieldHint: { fontFamily: FONT.body, fontSize: 10 },
  input: { paddingVertical: 10, paddingLeft: 12, paddingRight: 64, borderRadius: 12, borderWidth: 1, fontFamily: FONT.dataRegular, fontSize: 18, lineHeight: 24 },
  unit: { position: "absolute", right: 12, top: 0, bottom: 0, textAlignVertical: "center", lineHeight: 46, fontFamily: FONT.bodyStrong, fontSize: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { fontFamily: FONT.body, fontSize: 12 },
  rowVal: { fontFamily: FONT.dataStrong, fontSize: 14, fontVariant: ["tabular-nums"] },
  rowBig: { fontSize: 16 },
  profit: { marginTop: -2, minHeight: 12, textAlign: "right", fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  quoteErr: { textAlign: "center", fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, textDecorationLine: "underline" },
  place: { width: "100%", paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  placeGlow: { shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  placeOff: { opacity: 0.5 },
  placeInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  placeText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20, letterSpacing: 0.7 },
  footnote: { fontFamily: FONT.body, fontSize: 10, lineHeight: 16.25, textAlign: "center" },
  err: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  errIcon: { marginTop: 2 },
  errBody: { flex: 1, minWidth: 0, gap: 4 },
  errTitle: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 18 },
  errSummary: { fontFamily: FONT.body, fontSize: 10, lineHeight: 15 },
  errDetail: { fontFamily: FONT.body, fontSize: 11, lineHeight: 16 },
  errRetry: { fontFamily: FONT.body, fontSize: 10, lineHeight: 15, textDecorationLine: "underline" },
  txLink: { textAlign: "center", fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
});
