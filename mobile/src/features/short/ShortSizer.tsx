import { diagnosisCopy } from "@agari/core/copy";
import { leverageBpsOf, type LeverageReserveState } from "@agari/core/leverage";
import type { EventMarket } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits, parseDecimalToBaseUnits, priceRawToBps } from "@agari/core/units";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLeverageQuote, useLeverageWrites } from "@/features/leverage";
import { SHORT } from "@/features/short/copy";
import { notify } from "@/lib/toast";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { Money } from "./PageParts";
import { usePanelStyle } from "./ShortPicker";

/** web's `FILL_FLOOR_BPS`: the open accepts up to 5% fewer contracts than quoted, as the Ticket's boost does. */
const FILL_FLOOR_BPS = 9_500n;
const T = SHORT.ticket;

interface SizerProps {
  market: EventMarket;
  reserve: LeverageReserveState;
  symbol: string;
  walletBase: bigint | null;
  multiples: number[];
  multiple: number;
  onMultiple: (x: number) => void;
  amount: string;
  onAmount: (text: string) => void;
}

/**
 * web's `Sizer` in `ShortTicket.tsx`: stake with Max and the unit, the multiple chips and their hint, the three-cell
 * readout, the note, then "Short <ASSET> N× for <stake>" and the knock-out line under it. Every figure comes from
 * `sizeLeverageForStake`, the walk the program runs; the button sends web's own write, and the wallet's prompt is the
 * confirmation.
 */
export function ShortSizer({ market, reserve, symbol, walletBase, multiples, multiple, onMultiple, amount, onAmount }: SizerProps) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const panel = usePanelStyle();
  const [focused, setFocused] = useState(false);
  const { decimals, params, paused } = reserve;
  const writes = useLeverageWrites();
  const stakeBase = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
  const leverageBps = leverageBpsOf(multiple);
  const quoteState = useLeverageQuote({ market, side: "down", stakeBase, leverageBps, params, enabled: writes.canSign && !paused && stakeBase > 0n });
  const { quote } = quoteState;
  const wallet = walletBase ?? 0n;
  const two = (base: bigint, group = true) => formatBaseUnits(base, decimals, { minDp: 2, maxDp: 2, group });

  const open = async () => {
    if (!quote) return;
    const outcome = await writes.open({ marketId: market.marketId, side: "down", stakeBase, leverageBps, minQuantityRaw: (quote.quantityRaw * FILL_FLOOR_BPS) / 10_000n });
    if (!outcome) return;
    if (outcome.status === "confirmed") {
      haptic.success();
      onAmount("");
      notify.neutral(T.opened(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 }), market.asset));
      return;
    }
    if (outcome.status === "requote") {
      notify.warning(diagnosisCopy("requote").headline, T.requote(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 })));
      quoteState.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    notify.warning(copy.headline, outcome.diagnosis.technical || copy.body);
  };

  const thin = quoteState.error?.kind === "thin-book" ? thinBook(quoteState.error.technical, stakeBase) : null;
  const note = paused
    ? T.paused
    : stakeBase <= 0n
      ? T.enterAmount
      : thin
        ? thin.maxBase === null
          ? T.thinExit
          : thin.maxBase <= 0n
            ? T.thinNone
            : T.thinSome(two(thin.maxBase), symbol)
        : quoteState.error
          ? diagnosisCopy(quoteState.error.kind).headline
          : quote
            ? quote.stakeBase < stakeBase
              ? T.sized(formatBaseUnits(quote.stakeBase, decimals), symbol)
              : null
            : quoteState.loading
              ? T.pricing
              : null;
  const warn = quoteState.error !== null || thin !== null;
  const busy = writes.busy === "open";
  const ctaOff = !quote || busy || paused;

  return (
    <View style={panel}>
      <View style={styles.fieldHead}>
        <Text style={[styles.k, { color: color.inkDisabled }]}>{T.amount}</Text>
        <Text style={[styles.wallet, { color: color.inkDisabled }]} numberOfLines={1}>
          {walletBase === null ? T.walletPending : T.wallet(two(wallet), symbol)}
        </Text>
      </View>
      <View style={[styles.field, { borderColor: focused ? t.fieldFocus : t.fieldBorder, backgroundColor: t.fieldBg }]}>
        <TextInput
          value={amount}
          onChangeText={(text) => onAmount(text.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          placeholderTextColor={color.inkMuted}
          keyboardType="decimal-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={T.amount}
          style={[styles.input, { color: color.ink }]}
        />
        <Pressable onPress={() => onAmount(two(wallet, false))} disabled={walletBase === null} accessibilityRole="button" hitSlop={8} style={{ opacity: walletBase === null ? 0.4 : 1 }}>
          {({ pressed }) => <Text style={[styles.max, { color: pressed ? color.ink : color.accent }]}>{T.max}</Text>}
        </Pressable>
        <Text style={[styles.unit, { color: color.inkMuted }]}>{symbol}</Text>
      </View>

      <Text style={[styles.kGap, { color: color.inkMuted }]}>{T.multiple}</Text>
      <View style={styles.multiples} accessibilityLabel={T.multiple}>
        {multiples.map((x) => {
          const on = x === multiple;
          return (
            <Pressable
              key={x}
              onPress={() => {
                haptic.select();
                onMultiple(x);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.multiple, { borderColor: on ? t.multipleOnBorder : t.multipleBorder, backgroundColor: on ? t.multipleOnBg : "transparent" }]}
            >
              <Text style={[styles.multipleText, { color: on ? color.ink : color.inkMuted }]}>{x}×</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: color.inkDisabled }]}>{T.multipleHint(percentOf(params.premiumBps))}</Text>

      <View style={[styles.readout, { borderTopColor: t.readoutRule }]}>
        <Cell label={T.cells.contracts}>{quote ? formatBaseUnits(quote.quantityRaw, decimals, { minDp: 0, maxDp: 2 }) : "—"}</Cell>
        <Cell label={T.cells.entry}>{quote ? `${bpsToOddsCents(priceRawToBps(quote.priceRaw, decimals))}¢` : "—"}</Cell>
        <Cell label={T.cells.back}>{quote ? <Money value={quote.winIfRightBase} decimals={decimals} symbol={symbol} /> : "—"}</Cell>
      </View>
      {note ? <Text style={[styles.note, { color: warn ? t.warn : color.inkMuted }]}>{note}</Text> : null}
      {thin && thin.maxBase !== null && thin.maxBase > 0n ? (
        <Pressable
          onPress={() => onAmount(two(thin.maxBase as bigint, false))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.useMax, { borderColor: color.accent, backgroundColor: pressed ? color.accent : color.accentWash }]}
        >
          {({ pressed }) => <Text style={[styles.useMaxText, { color: pressed ? color.onAccent : color.ink }]}>{T.useMax(two(thin.maxBase as bigint), symbol)}</Text>}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => void open()}
        disabled={ctaOff}
        accessibilityRole="button"
        accessibilityState={{ disabled: ctaOff, busy }}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: pressed && !ctaOff ? color.accentPressed : color.accent, opacity: ctaOff ? 0.4 : 1, transform: [{ scale: pressed && !ctaOff ? 0.98 : 1 }] },
        ]}
      >
        <Text style={[styles.ctaText, { color: color.onAccent }]}>
          {busy ? T.busy : quote ? <>{T.cta(market.asset, multiple)} <Money value={quote.stakeBase} decimals={decimals} symbol={symbol} style={{ color: color.onAccent }} /></> : T.ctaPlain}
        </Text>
      </Pressable>
      {quote ? <Text style={[styles.knock, { color: color.inkDisabled }]}>{T.knockNote(formatBaseUnits(quote.lineBase, decimals), symbol)}</Text> : null}
    </View>
  );
}

/** `.sh-cell`: the 8 px mono label over the figure. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.dt, { color: color.inkDisabled }]}>{label}</Text>
      <Text style={[styles.dd, { color: color.ink }]}>{children}</Text>
    </View>
  );
}

/** web's `thinBook`: the stake that fits a thin book is the offered share of it, less 5% for the book moving. */
function thinBook(technical: string, stakeBase: bigint): { maxBase: bigint | null } {
  const m = /^(\d+) of the (\d+) this stake buys is on offer/.exec(technical);
  if (!m) return { maxBase: null };
  const filled = BigInt(m[1] as string);
  const wanted = BigInt(m[2] as string);
  if (filled <= 0n || wanted <= 0n) return { maxBase: 0n };
  return { maxBase: (stakeBase * filled * 95n) / (wanted * 100n) };
}

/** A bps parameter as the percentage the copy names: 800 → "8%". */
export function percentOf(bps: number): string {
  return `${Math.round(bps / 10) / 10}%`;
}

const styles = StyleSheet.create({
  fieldHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  k: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  wallet: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  field: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 },
  input: { flex: 1, minWidth: 0, padding: 0, fontFamily: FONT.body, fontSize: 24, lineHeight: 32, height: 32, fontVariant: ["tabular-nums"] },
  max: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.5, textTransform: "uppercase" },
  unit: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  kGap: { marginTop: 20, marginBottom: 8, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  multiples: { flexDirection: "row", gap: 8 },
  multiple: { flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 10, alignItems: "center" },
  multipleText: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  hint: { marginTop: 10, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  readout: { flexDirection: "row", gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  cell: { flex: 1, minWidth: 0 },
  dt: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.28, textTransform: "uppercase" },
  dd: { fontFamily: FONT.body, fontSize: 14, lineHeight: 16.8, fontVariant: ["tabular-nums"] },
  note: { marginTop: 12, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  useMax: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 9999 },
  useMaxText: { fontFamily: FONT.dataRegular, fontSize: 11.5, lineHeight: 18.4 },
  cta: { marginTop: 16, paddingVertical: 14, borderRadius: 9999, alignItems: "center" },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 24, textAlign: "center" },
  knock: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, textAlign: "center" },
});
