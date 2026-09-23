import { parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGY_DIRECTION } from "@/features/strategies/copy";
import { COPY_FORM } from "@/features/strategies/copy-form-copy";
import { money } from "@/features/strategies/format";
import { useVaultWrite } from "@/features/vault/useVaultWrite";
import { Button, Segmented } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { AmountInput } from "./AmountInput";
import { ReviewGate } from "./ReviewGate";
import type { CopySetup, DeskWrites } from "./useCopySetup";

/**
 * web's CopyFormFields.tsx and the form half of CopyDrawer.tsx: how you are copied, the money strip, the budget and
 * per-trade fields, an inline deposit to the Trading Balance, the permission sentence, the live fee, then the review.
 */
export function CopyForm({ setup, writes, name, strategyId, decimals, symbol, availableBase, hasOtherGrant, hasSub }: {
  setup: CopySetup;
  writes: DeskWrites;
  name: string;
  strategyId: string;
  decimals: number;
  symbol: string;
  availableBase: bigint;
  /** The wallet's current strategy permission belongs to another subscription and will be replaced. */
  hasOtherGrant: boolean;
  /** A consent record exists (active or paused). */
  hasSub: boolean;
}) {
  const { color } = useTheme();
  const s = setup;
  const fee = s.currentFee.fee;
  const text = (base: bigint) => money(base, decimals).replace(/,/g, "");
  const cash = (base: bigint) => money(base, decimals, symbol);
  const label = writes.busy === "join"
    ? "Checking wallet steps…"
    : s.pending
      ? "Check and finish subscription"
      : s.state === "copying"
        ? "Update budget and limits"
        : hasSub
          ? "Resume with these limits"
          : s.fade
            ? "Fund permission and fade"
            : "Fund permission and copy";
  const price = s.caps.maxPriceRaw === 0n ? "no ceiling" : `${cash(s.caps.maxPriceRaw)} / share`;

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{STRATEGY_DIRECTION.label}</Text>
        <Segmented
          label={STRATEGY_DIRECTION.label}
          options={[
            { value: "copy", label: STRATEGY_DIRECTION.copy },
            { value: "fade", label: STRATEGY_DIRECTION.fade },
          ]}
          value={s.fade ? "fade" : "copy"}
          onChange={(v) => {
            if (!s.directionLocked && !s.disabled) s.setFade(v === "fade");
          }}
        />
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {s.directionLocked ? (s.fade ? STRATEGY_DIRECTION.lockedFade : STRATEGY_DIRECTION.lockedCopy) : s.fade ? STRATEGY_DIRECTION.fadeNote : STRATEGY_DIRECTION.copyNote}
        </Text>
      </View>

      <View style={[styles.strip, { borderColor: color.hairline }]} accessibilityLabel={COPY_FORM.strip.pulls}>
        <Cell label={COPY_FORM.strip.wallet} value={s.walletBase === null ? "—" : cash(s.walletBase)} />
        <Cell label={COPY_FORM.strip.vault} value={cash(availableBase)} />
        <Cell
          label={COPY_FORM.strip.pulls}
          value={cash(s.check.topUpBase + (fee ?? 0n))}
          note={COPY_FORM.strip.pullsDetail(fee ? cash(fee) : null)}
          bad={Boolean(s.check.budgetError)}
        />
      </View>

      <AmountInput
        label="Total budget"
        symbol={symbol}
        value={s.pending ? text(s.targetBase) : s.budget}
        onChange={s.setBudget}
        error={s.check.budgetError}
        disabled={Boolean(s.pending) || s.disabled}
        maxDisabled={s.check.maxBudgetBase === null || s.check.maxBudgetBase <= 0n}
        onMax={() => s.check.maxBudgetBase !== null && s.setBudget(text(s.check.maxBudgetBase))}
      />
      <AmountInput
        label="Most per trade"
        symbol={symbol}
        value={s.pending ? text(s.ceilingBase) : s.perTrade}
        onChange={s.setPerTrade}
        error={s.check.perTradeError}
        disabled={Boolean(s.pending) || s.disabled}
        maxDisabled={s.check.maxPerTradeBase <= 0n}
        onMax={() => s.setPerTrade(text(s.check.maxPerTradeBase))}
        hint={`Strategy maximum: ${cash(s.envelope.maxStakePerTradeBase)} per trade. This permission lasts 30 days.`}
      />
      <TradingBalanceDeposit walletBase={s.walletBase} decimals={decimals} symbol={symbol} />

      {s.valid ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          Your permission: {cash(s.caps.maxStakePerTradeBase)} per trade, {cash(s.caps.maxDailySpendBase)} per day, {s.caps.maxOpenPositions} open position
          {s.caps.maxOpenPositions === 1 ? "" : "s"}, {s.caps.maxPriceRaw === 0n ? "without an entry-price ceiling" : `with a maximum entry price of ${cash(s.caps.maxPriceRaw)} per share`}.
        </Text>
      ) : null}

      <View style={[styles.fee, { backgroundColor: color.surface2 }]}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Subscription fee: {fee === null ? "checking…" : cash(fee)}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          This fee is charged each time you subscribe, including a resume or a change to your limits. The vault budget is separate.
        </Text>
        {s.currentFee.error ? <Text style={[TYPE.caption, { color: color.loss }]}>{s.currentFee.error}</Text> : null}
        <Button label="Refresh fee" variant="outline" size="sm" block={false} disabled={Boolean(writes.busy)} onPress={s.currentFee.refresh} />
      </View>
      {hasOtherGrant ? (
        <Text style={[TYPE.caption, { color: color.loss }]}>
          This replaces your current strategy permission and stops its future copies. Its unspent budget becomes available for this setup.
        </Text>
      ) : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        The wallet requests permission first, then subscription consent. Losses are possible within your limits.
      </Text>

      <ReviewGate
        cta={label}
        title={`${s.fade ? "Fade" : "Copy"} ${name} · #${strategyId}`}
        lines={[
          { label: "How you are copied", value: s.fade ? STRATEGY_DIRECTION.fade : STRATEGY_DIRECTION.copy },
          { label: "Total budget", value: cash(s.targetBase) },
          { label: "Most per trade", value: cash(s.caps.maxStakePerTradeBase) },
          { label: "Most per day", value: cash(s.caps.maxDailySpendBase) },
          { label: "Open positions", value: String(s.caps.maxOpenPositions) },
          { label: "Entry price", value: price },
          { label: "Deposit from wallet", value: cash(s.topUp) },
          { label: "Subscription fee", value: fee === null ? "—" : cash(fee), tone: "accent" },
          { label: "Signatures", value: s.pending ? "1 (subscribe)" : "2 (permission, subscribe)", tone: "muted" },
        ]}
        maxLoss={fee === null ? "—" : cash(s.targetBase + fee)}
        confirmLabel={s.fade ? "Slide to fade" : "Slide to copy"}
        onConfirm={s.join}
        busy={writes.busy === "join"}
        blocker={s.check.blockedBy}
        disabled={Boolean(writes.busy)}
      />
      {s.check.blockedBy ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{s.check.blockedBy}</Text> : null}
    </View>
  );
}

function Cell({ label, value, note, bad }: { label: string; value: string; note?: string; bad?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[TYPE.data, { color: bad ? color.loss : color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note ? <Text style={[TYPE.caption, styles.note, { color: color.inkMuted }]}>{note}</Text> : null}
    </View>
  );
}

/** web's "+ Add tUSDC to your Trading Balance": one vault deposit, reviewed before the wallet asks. */
function TradingBalanceDeposit({ walletBase, decimals, symbol }: { walletBase: bigint | null; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const vault = useVaultWrite();
  const [open, setOpen] = useState(false);
  const [deposit, setDeposit] = useState("");
  const base = parseDecimalToBaseUnits(deposit.trim() || "0", decimals) ?? 0n;
  const blocker = base <= 0n ? "Enter an amount." : walletBase === null ? "Reading your wallet…" : base > walletBase ? "More than your wallet holds." : !vault.hasSigner ? "Connect a wallet that can sign." : null;
  if (!open) {
    return <Button label={`+ ${COPY_FORM.addFunds.toggle}`} variant="ghost" size="sm" block={false} onPress={() => setOpen(true)} />;
  }
  return (
    <View style={[styles.deposit, { borderColor: color.hairline }]}>
      <AmountInput
        label={COPY_FORM.addFunds.label}
        symbol={symbol}
        value={deposit}
        onChange={setDeposit}
        onMax={walletBase ? () => setDeposit(money(walletBase, decimals).replace(/,/g, "")) : undefined}
      />
      <ReviewGate
        cta={COPY_FORM.addFunds.deposit}
        variant="secondary"
        title="Deposit to your Trading Balance"
        lines={[{ label: "Deposit", value: `${money(base, decimals)} ${symbol}` }]}
        maxLoss={null}
        confirmLabel="Slide to deposit"
        busy={vault.state.busy === "vault-deposit"}
        blocker={blocker}
        onConfirm={() =>
          vault.run({ kind: "vault-deposit", amountBase: base }, COPY_FORM.addFunds.landed).then((o) => {
            if (o?.status === "confirmed") setDeposit("");
          })
        }
      />
      <Button label="Close" variant="ghost" size="sm" block={false} onPress={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  block: { gap: 8 },
  strip: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  cell: { flex: 1, gap: 4 },
  note: { fontSize: 11, lineHeight: 14 },
  fee: { borderRadius: RADIUS.md, padding: 12, gap: 6 },
  deposit: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 10 },
});
