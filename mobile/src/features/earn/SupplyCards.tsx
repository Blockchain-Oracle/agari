import { realizedYield, supplierPosition, type ReserveSheet } from "@agari/core/reserves";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import { formatSharePrice, money2, quickAmounts } from "@/features/earn/format";
import type { ReserveWords } from "@/features/earn/reserves";
import { FONT } from "~/theme";
import { ConnectButton, KeepCase, useEarnParlay } from "./EarnKit";

interface SupplyCardProps {
  connected: boolean;
  sheet: ReserveSheet;
  symbol: string;
  walletBase: bigint | null;
  busy: string | null;
  onSupply: (amountBase: bigint) => Promise<boolean> | void;
  onMessage: (text: string) => void;
}

/** web's `SupplyCard` (`features/earn/SupplyCards.tsx`): the amount, Max, wallet-scaled quick amounts, Supply. */
export function SupplyCard({ connected, sheet, symbol, walletBase, busy, onSupply, onMessage }: SupplyCardProps) {
  const { color, t } = useEarnParlay();
  const { supply } = EARN;
  const [amount, setAmount] = useState("");
  const [focused, setFocused] = useState(false);
  const { decimals, paused } = sheet;
  // null while the balance sheet is still reading: the line says so, and nothing is sized off a zero that is not one.
  const wallet = walletBase ?? 0n;
  const walletText = formatBaseUnits(wallet, decimals, { minDp: 2, maxDp: 2, group: false });

  const submit = () => {
    if (paused) return;
    let base = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
    if (base <= 0n) return onMessage(supply.enterAmount);
    if (walletBase === null) return onMessage(supply.walletReading);
    if (wallet <= 0n) return onMessage(supply.noFunds(symbol));
    if (base > wallet) base = wallet;
    // Cleared only once the supply lands; a rejected signature keeps the figure.
    void Promise.resolve(onSupply(base)).then((ok) => {
      if (ok) setAmount("");
    });
  };
  const supplying = busy === "supply";

  return (
    <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardShadow }]}>
      {!connected ? (
        <View style={styles.connect}>
          <Text style={[styles.connectText, { color: color.inkMuted }]}>{supply.connect}</Text>
          <ConnectButton />
        </View>
      ) : (
        <>
          <View style={styles.fieldHead}>
            <Text style={[styles.k10, { color: color.inkDisabled }]}>{supply.amount}</Text>
            <Text numberOfLines={1} style={[styles.wallet, { color: color.inkDisabled }]}>
              {walletBase === null ? supply.walletPending : supply.wallet(money2(wallet, decimals), symbol)}
            </Text>
          </View>
          <View style={[styles.field, { borderColor: focused ? t.fieldFocus : t.fieldBorder, backgroundColor: t.fieldBg }]}>
            <TextInput
              value={amount}
              onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              placeholderTextColor={t.placeholder}
              keyboardType="decimal-pad"
              accessibilityLabel={supply.amount}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              selectionColor={color.accent}
              style={[styles.input, { color: color.ink }]}
            />
            <Pressable onPress={() => setAmount(walletText)} disabled={walletBase === null} hitSlop={8} accessibilityRole="button">
              {({ pressed }) => <Text style={[styles.max, { color: pressed ? color.ink : color.accent }]}>{supply.max}</Text>}
            </Pressable>
            <Text style={[styles.inputUnit, { color: color.inkMuted }]}>{symbol}</Text>
          </View>
          <View style={styles.quick}>
            {quickAmounts(wallet, decimals).map((a) => {
              const on = amount === a;
              return (
                <Pressable
                  key={a}
                  onPress={() => setAmount(a)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, on ? { backgroundColor: t.quickOnBg, borderColor: t.quickOnBorder } : { borderColor: t.chipBorder }]}
                >
                  <Text style={[styles.chipText, { color: on ? color.ink : color.inkMuted }]}>{a}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={submit}
            disabled={supplying || paused}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.supply,
              { backgroundColor: pressed ? color.accentPressed : color.accent, opacity: supplying || paused ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Text style={[styles.supplyText, { color: color.onAccent }]}>{paused ? supply.pausedButton : supplying ? supply.busy : supply.button(symbol)}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

interface PositionCardProps {
  connected: boolean;
  sheet: ReserveSheet;
  words: ReserveWords;
  symbol: string;
  shares: bigint;
  worthBase: bigint;
  suppliedBase: bigint;
  withdrawnBase: bigint;
  /** Maker only: a closed Window the exit has to settle first, which the note names before it is sent. */
  unsettledExpired?: boolean;
  busy: string | null;
  onWithdraw: (shares: bigint) => void;
}

/**
 * web's `PositionCard`: value, shares at the share price, a withdrawal of exactly what free capital covers, the
 * realized and on-paper lines (never a rate), and what the reserve is still holding in its own word.
 */
export function PositionCard(props: PositionCardProps) {
  const { connected, sheet, words, symbol, shares, worthBase, suppliedBase, withdrawnBase, unsettledExpired = false, busy, onWithdraw } = props;
  const { color, t } = useEarnParlay();
  const { position } = EARN;
  const { decimals } = sheet;
  const held = supplierPosition(sheet, shares, worthBase);
  const earned = realizedYield({ suppliedBase, withdrawnBase, worthBase });
  // A difference under a cent is not a loss: it is the floor in the share arithmetic, so it reads as level.
  const onPaperText = money2(earned.unrealizedBase < 0n ? -earned.unrealizedBase : earned.unrealizedBase, decimals);
  const onPaperZero = parseDecimalToBaseUnits(onPaperText, decimals) === 0n;
  const onPaper = onPaperZero
    ? { style: { color: color.inkMuted }, text: position.unrealizedFlat }
    : earned.unrealizedBase < 0n
      ? { style: [styles.earnedMono, { color: color.accent }], text: position.unrealizedDown(onPaperText, symbol) }
      : { style: [styles.earnedMono, { color: color.profit }], text: position.unrealized(onPaperText, symbol) };
  const withdrawing = busy === "withdraw";
  const cantWithdraw = withdrawing || held.idleShares === 0n;
  return (
    <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardShadow }]}>
      <Text style={[styles.k10, styles.positionTitle, { color: color.inkDisabled }]}>{position.title}</Text>
      {!connected ? (
        <Text style={[styles.empty, { color: color.inkMuted }]}>{position.connect}</Text>
      ) : held.shares <= 0n && earned.realizedBase <= 0n ? (
        <Text style={[styles.empty, { color: color.inkMuted }]}>{position.empty}</Text>
      ) : (
        <>
          <Text style={[styles.value, { color: color.ink }]}>
            {money2(held.worthBase, decimals)} <Text style={[styles.valueUnit, { color: color.inkMuted }]}>{symbol}</Text>
          </Text>
          <Text style={[styles.sub, { color: color.inkMuted }]}>
            {position.shares(formatBaseUnits(held.shares, decimals, { minDp: 2, maxDp: 2 }), formatSharePrice(sheet.sharePriceRaw, decimals))}
          </Text>
          <Pressable
            onPress={() => onWithdraw(held.idleShares)}
            disabled={cantWithdraw}
            accessibilityRole="button"
            style={[styles.withdraw, { borderColor: t.ghostBorder, opacity: cantWithdraw ? 0.5 : 1 }]}
          >
            {({ pressed }) => (
              <Text style={[styles.withdrawText, { color: pressed ? color.ink : color.accent }]}>
                {withdrawing ? position.busy : held.committedBase === 0n ? position.withdrawAll : <KeepCase text={position.withdrawIdle(money2(held.idleBase, decimals), symbol)} symbol={symbol} />}
              </Text>
            )}
          </Pressable>
          <View style={[styles.earned, { borderTopColor: t.earnedRule }]}>
            <View>
              <Text style={[styles.k9, { color: color.inkMuted }]}>{position.realizedLabel}</Text>
              <Text style={[styles.earnedV, earned.realizedBase > 0n ? [styles.earnedMono, { color: color.profit }] : { color: color.inkMuted }]}>
                {earned.realizedBase > 0n ? position.realized(money2(earned.realizedBase, decimals), symbol) : position.realizedNone}
              </Text>
            </View>
            {held.shares > 0n ? (
              <View>
                <Text style={[styles.k9, { color: color.inkMuted }]}>{position.unrealizedLabel}</Text>
                <Text style={[styles.earnedV, onPaper.style]}>{onPaper.text}</Text>
              </View>
            ) : null}
          </View>
          {held.committedBase > 0n ? <Text style={[styles.note, { color: color.inkMuted }]}>{words.committedNote(money2(held.committedBase, decimals), symbol)}</Text> : null}
          {unsettledExpired ? <Text style={[styles.note, { color: color.inkMuted }]}>{position.unsettledNote}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  connect: { paddingVertical: 32, alignItems: "center" },
  connectText: { marginBottom: 16, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16, textAlign: "center" },
  fieldHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12, minWidth: 0 },
  k10: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, textTransform: "uppercase" },
  k9: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.62, textTransform: "uppercase" },
  wallet: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  field: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12 },
  input: { flex: 1, minWidth: 0, padding: 0, fontFamily: FONT.dataRegular, fontSize: 24, lineHeight: 32, height: 32 },
  max: { fontFamily: FONT.dataRegular, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
  inputUnit: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 20 },
  quick: { flexDirection: "row", gap: 8, marginBottom: 16 },
  chip: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16 },
  supply: { width: "100%", maxWidth: 280, alignSelf: "center", borderRadius: 9999, paddingVertical: 14, alignItems: "center" },
  supplyText: { fontFamily: FONT.bodyStrong, fontSize: 16, lineHeight: 24 },
  positionTitle: { marginBottom: 16 },
  empty: { paddingVertical: 40, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16 },
  value: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 40, letterSpacing: -0.9 },
  valueUnit: { fontFamily: FONT.dataRegular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  sub: { marginTop: 4, marginBottom: 20, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  withdraw: { width: "100%", maxWidth: 280, alignSelf: "center", borderRadius: 9999, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  withdrawText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  earned: { gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  earnedV: { fontFamily: FONT.body, fontSize: 12, lineHeight: 17.4 },
  earnedMono: { fontFamily: FONT.dataRegular },
  note: { marginTop: 12, textAlign: "center", fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
});
