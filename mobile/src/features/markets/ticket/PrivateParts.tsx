import { formatCadence, type BlockerContext } from "@agari/core/copy";
import type { Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PRIVATE } from "@/features/private/copy";
import type { PrivateTicketState } from "@/features/private/usePrivateTicket";
import { BlockedButton } from "./TicketButton";
import { tkType, useTk } from "./tk";

/**
 * web's PrivateNote: the one case worth interrupting for is Private chosen with nothing behind it — said before a
 * signature, in the vermilion box with its fix (add funds, or re-allow when only the allowance ran short). Otherwise one
 * quiet line, and the honest one-liner under it.
 */
export function PrivateNote({ priv, stakeBase, decimals, symbol }: { priv: PrivateTicketState; stakeBase: bigint; decimals: number; symbol: string }) {
  const tk = useTk();
  const fmt = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const budget = priv.budget;
  const short = budget !== null && stakeBase > 0n && priv.depositShortBase > 0n;
  const busy = priv.busy !== null;
  const quiet = (text: string) => <Text style={[tkType.caption, { color: tk.caption }]}>{text}</Text>;
  const line = (text: string) => <Text style={[tkType.chip, styles.left, { color: tk.caption }]}>{text}</Text>;
  if (priv.pending) {
    return (
      <View style={styles.stack}>
        {line(PRIVATE.note.pending(`${priv.pending.asset} ${formatCadence(priv.pending.intervalSec)}`))}
        {quiet(PRIVATE.note.honesty)}
      </View>
    );
  }
  const box = (text: string, action: string, disabled: boolean) => (
    <View style={[styles.box, { borderColor: tk.privBorder, backgroundColor: tk.privBg }]}>
      <Text style={[tkType.chip, styles.boxText, { color: tk.privText }]}>{text}</Text>
      <Pressable onPress={() => void priv.fund()} disabled={disabled} accessibilityRole="button" hitSlop={8} style={disabled && styles.half}>
        <Text style={[tkType.label, styles.action, { color: tk.vermilion }]}>{priv.busy === "fund" ? PRIVATE.note.adding : action}</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={styles.stack}>
      {short && budget
        ? box(budget.balanceBase > 0n ? PRIVATE.note.balance(fmt(budget.balanceBase)) : PRIVATE.note.empty, PRIVATE.note.addFunds, busy || priv.topUpBase === 0n)
        : priv.reallowOnly && budget
          ? box(PRIVATE.note.reallow(fmt(budget.balanceBase), fmt(budget.allowanceBase)), PRIVATE.note.reallowAction, busy)
          : line(PRIVATE.note.always)}
      {quiet(PRIVATE.note.honesty)}
      {short || priv.reallowOnly ? quiet(PRIVATE.note.signatures) : null}
    </View>
  );
}

/** web's PrivateCta: "Buy UP privately for X", the top-up or re-allow and the bet as one action, or the resume of a lost reply. */
export function PrivateCta({ priv, side, decimals, symbol, ctx }: { priv: PrivateTicketState; side: Side | null; decimals: number; symbol: string; ctx: BlockerContext }) {
  const q = priv.quote;
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const label = priv.pending
    ? PRIVATE.cta.resume(`${priv.pending.asset} ${formatCadence(priv.pending.intervalSec)}`)
    : side && q
      ? priv.depositShortBase > 0n
        ? PRIVATE.cta.fundAndBuy(money(priv.topUpBase), SIDE_WORD[side])
        : priv.reallowOnly
          ? PRIVATE.cta.reallowAndBuy(SIDE_WORD[side])
          : `${PRIVATE.cta.buy(SIDE_WORD[side])} ${money(q.costBase)}`
      : PRIVATE.cta.buyPlain;
  return <BlockedButton blocker={priv.blocker} ctx={{ ...ctx, ...priv.ctx }} tone={side ?? "primary"} label={label} onPress={() => void priv.place()} />;
}

const styles = StyleSheet.create({
  stack: { gap: 4 },
  left: { textAlign: "left" },
  box: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 4, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10 },
  boxText: { flex: 1, textAlign: "left", lineHeight: 12.4 },
  action: { letterSpacing: 1.26 },
  half: { opacity: 0.5 },
});
