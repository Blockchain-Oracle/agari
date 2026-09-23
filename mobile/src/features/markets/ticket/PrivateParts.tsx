import { formatCadence } from "@agari/core/copy";
import type { Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PRIVATE } from "@/features/private/copy";
import type { PrivateTicketState } from "@/features/private/usePrivateTicket";
import { Button } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's PrivateNote: the one case worth interrupting for is Private chosen with nothing behind it — said before a
 * signature, with the fix (add funds, or re-allow when only the allowance ran short) right there. Otherwise one quiet
 * line and the honest one-liner under it.
 */
export function PrivateNote({ priv, stakeBase, decimals, symbol }: { priv: PrivateTicketState; stakeBase: bigint; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const fmt = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const budget = priv.budget;
  const short = budget !== null && stakeBase > 0n && priv.depositShortBase > 0n;
  const busy = priv.busy !== null;
  if (priv.pending) {
    return (
      <View style={styles.stack}>
        <Text style={[TYPE.caption, { color: color.warning }]}>{PRIVATE.note.pending(`${priv.pending.asset} ${formatCadence(priv.pending.intervalSec)}`)}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{PRIVATE.note.honesty}</Text>
      </View>
    );
  }
  const box = (text: string, action: string) => (
    <View style={[styles.box, { borderColor: color.accentDim, backgroundColor: color.accentWash }]}>
      <Text style={[TYPE.caption, styles.grow, { color: color.ink }]}>{text}</Text>
      <Button label={priv.busy === "fund" ? PRIVATE.note.adding : action} size="sm" block={false} disabled={busy || (short && priv.topUpBase === 0n)} onPress={() => void priv.fund()} />
    </View>
  );
  return (
    <View style={styles.stack}>
      {short && budget
        ? box(budget.balanceBase > 0n ? PRIVATE.note.balance(fmt(budget.balanceBase)) : PRIVATE.note.empty, PRIVATE.note.addFunds)
        : priv.reallowOnly && budget
          ? box(PRIVATE.note.reallow(fmt(budget.balanceBase), fmt(budget.allowanceBase)), PRIVATE.note.reallowAction)
          : <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{PRIVATE.note.always}</Text>}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{PRIVATE.note.honesty}</Text>
      {short || priv.reallowOnly ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{PRIVATE.note.signatures}</Text> : null}
    </View>
  );
}

/** web's PrivateCta label: top-up-and-buy, re-allow-and-buy, or the resume of a lost reply; null means the plain "Buy privately". */
export function privateCtaLabel(priv: PrivateTicketState, side: Side | null, decimals: number, symbol: string): string | null {
  if (priv.pending) return PRIVATE.cta.resume(`${priv.pending.asset} ${formatCadence(priv.pending.intervalSec)}`);
  if (!side || !priv.quote) return null;
  if (priv.depositShortBase > 0n) return PRIVATE.cta.fundAndBuy(`${formatBaseUnits(priv.topUpBase, decimals)} ${symbol}`, SIDE_WORD[side]);
  if (priv.reallowOnly) return PRIVATE.cta.reallowAndBuy(SIDE_WORD[side]);
  return null;
}

const styles = StyleSheet.create({
  stack: { gap: 6 },
  box: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: RADIUS.md, padding: 10 },
  grow: { flex: 1 },
});
