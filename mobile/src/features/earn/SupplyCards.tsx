import { realizedYield, supplierPosition, type ReserveSheet } from "@agari/core/reserves";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import { formatSharePrice, money2, quickAmounts } from "@/features/earn/format";
import type { ReserveWords } from "@/features/earn/reserves";
import { Button, Card, Chips, ConnectGate, Field, Row, Rows } from "~/components/kit";
import type { ReviewRequest } from "~/features/short/ReviewSheet";
import { TYPE, useTheme } from "~/theme";

const S = EARN.supply;
const P = EARN.position;

interface SupplyCardProps {
  sheet: ReserveSheet;
  words: ReserveWords;
  symbol: string;
  walletBase: bigint | null;
  busy: string | null;
  onSupply: (amountBase: bigint) => Promise<boolean>;
  onMessage: (text: string) => void;
  onReview: (request: ReviewRequest) => void;
}

// 21st: ssychui/swap-ticket — the amount card: label row with the balance and Max, the big mono field, quick picks.
/**
 * web's `SupplyCard` (`features/earn/SupplyCards.tsx`): the amount, Max, wallet-scaled quick amounts, Supply —
 * with web's own refusals (enter an amount, still reading, no funds), capped at the wallet, then the review.
 */
export function SupplyCard({ sheet, words, symbol, walletBase, busy, onSupply, onMessage, onReview }: SupplyCardProps) {
  const { color } = useTheme();
  const [amount, setAmount] = useState("");
  const { decimals, paused } = sheet;
  const wallet = walletBase ?? 0n;
  const walletText = formatBaseUnits(wallet, decimals, { minDp: 2, maxDp: 2, group: false });

  const submit = () => {
    if (paused) return;
    let base = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
    if (base <= 0n) return onMessage(S.enterAmount);
    if (walletBase === null) return onMessage(S.walletReading);
    if (wallet <= 0n) return onMessage(S.noFunds(symbol));
    if (base > wallet) base = wallet;
    const money = (value: bigint) => `${money2(value, decimals)} ${symbol}`;
    onReview({
      title: `${words.supplyTitle} · ${words.label}`,
      lines: [
        { label: "You supply", value: money(base) },
        { label: "Share price now", value: `${formatSharePrice(sheet.sharePriceRaw, decimals)} ${EARN.panel.perShare}` },
        { label: "Free to withdraw now", value: money(sheet.liquidBase), tone: "muted" },
        { label: "Wallet after", value: money(wallet - base) },
      ],
      maxLoss: money(base),
      confirmLabel: `Slide to supply ${symbol}`,
      send: async () => {
        const ok = await onSupply(base);
        if (ok) setAmount("");
        return ok;
      },
    });
  };

  return (
    <ConnectGate why={S.connect}>
      <Card>
        <Field
          label={S.amount}
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          numeric
          suffix={symbol}
        />
        <View style={styles.walletRow}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{walletBase === null ? S.walletPending : S.wallet(money2(wallet, decimals), symbol)}</Text>
          <Button label={S.max} variant="ghost" size="sm" block={false} disabled={walletBase === null} onPress={() => setAmount(walletText)} />
        </View>
        <Chips options={quickAmounts(wallet, decimals).map((a) => ({ value: a, label: a }))} value={amount} onPick={setAmount} />
        <Button
          label={paused ? S.pausedButton : busy === "supply" ? S.busy : S.button(symbol)}
          size="lg"
          loading={busy === "supply"}
          disabled={paused}
          onPress={submit}
        />
      </Card>
    </ConnectGate>
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
  unsettledExpired?: boolean;
  busy: string | null;
  onWithdraw: (shares: bigint) => void;
  onReview: (request: ReviewRequest) => void;
}

/**
 * web's `PositionCard`: value, shares at the share price, the realized and on-paper lines (never a rate), and a
 * withdrawal of exactly what free capital covers, naming what the reserve is still holding in its own word.
 */
export function PositionCard(props: PositionCardProps) {
  const { connected, sheet, words, symbol, shares, worthBase, suppliedBase, withdrawnBase, unsettledExpired = false, busy, onWithdraw, onReview } = props;
  const { color } = useTheme();
  const { decimals } = sheet;
  const held = supplierPosition(sheet, shares, worthBase);
  const earned = realizedYield({ suppliedBase, withdrawnBase, worthBase });
  const onPaperText = money2(earned.unrealizedBase < 0n ? -earned.unrealizedBase : earned.unrealizedBase, decimals);
  const onPaperZero = parseDecimalToBaseUnits(onPaperText, decimals) === 0n;
  const onPaper = onPaperZero
    ? { ink: color.inkSecondary, text: P.unrealizedFlat }
    : earned.unrealizedBase < 0n
      ? { ink: color.loss, text: P.unrealizedDown(onPaperText, symbol) }
      : { ink: color.profit, text: P.unrealized(onPaperText, symbol) };
  const withdrawing = busy === "withdraw";
  const money = (value: bigint) => `${money2(value, decimals)} ${symbol}`;

  const review = () =>
    onReview({
      title: `Withdraw from the ${words.label.toLowerCase()}`,
      lines: [
        { label: "Shares redeemed", value: formatBaseUnits(held.idleShares, decimals, { minDp: 2, maxDp: 2 }) },
        { label: "At the share price", value: formatSharePrice(sheet.sharePriceRaw, decimals) },
        { label: "To your wallet", value: money(held.idleBase), tone: "profit" },
        ...(held.committedBase > 0n ? [{ label: `Still ${words.committed.toLowerCase()}`, value: money(held.committedBase), tone: "muted" as const }] : []),
      ],
      maxLoss: null,
      confirmLabel: "Slide to withdraw",
      send: async () => {
        onWithdraw(held.idleShares);
        return null;
      },
    });

  return (
    <Card>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.title}</Text>
      {!connected ? (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{P.connect}</Text>
      ) : held.shares <= 0n && earned.realizedBase <= 0n ? (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{P.empty}</Text>
      ) : (
        <>
          <Text style={[TYPE.dataHero, { color: color.ink }]}>
            {money2(held.worthBase, decimals)} <Text style={[TYPE.data, { color: color.inkMuted }]}>{symbol}</Text>
          </Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {P.shares(formatBaseUnits(held.shares, decimals, { minDp: 2, maxDp: 2 }), formatSharePrice(sheet.sharePriceRaw, decimals))}
          </Text>
          <Rows>
            <Row label={P.realizedLabel} value={earned.realizedBase > 0n ? P.realized(money2(earned.realizedBase, decimals), symbol) : "—"} tone={earned.realizedBase > 0n ? "profit" : "muted"} />
            {held.shares > 0n ? <Row label={P.unrealizedLabel} value={onPaperZero ? "Level" : `${earned.unrealizedBase < 0n ? "−" : "+"}${onPaperText} ${symbol}`} tone={onPaperZero ? "muted" : earned.unrealizedBase < 0n ? "loss" : "profit"} /> : null}
          </Rows>
          {earned.realizedBase <= 0n ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{P.realizedNone}</Text> : null}
          {held.shares > 0n ? <Text style={[TYPE.caption, { color: onPaper.ink }]}>{onPaper.text}</Text> : null}
          <Button
            label={withdrawing ? P.busy : held.committedBase === 0n ? P.withdrawAll : P.withdrawIdle(money2(held.idleBase, decimals), symbol)}
            variant="outline"
            loading={withdrawing}
            disabled={held.idleShares === 0n}
            onPress={review}
          />
          {held.committedBase > 0n ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.committedNote(money2(held.committedBase, decimals), symbol)}</Text> : null}
          {unsettledExpired ? <Text style={[TYPE.caption, { color: color.warning }]}>{P.unsettledNote}</Text> : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  walletRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: -4 },
});
