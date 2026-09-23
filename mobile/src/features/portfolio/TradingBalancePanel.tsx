import { blockerLabel } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import type { VenueCredit } from "@agari/core/types";
import { formatUtc, parseDecimalToBaseUnits, shortHex } from "@agari/core/units";
import type { VaultIntent } from "@agari/core/ports";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { VAULT } from "@/features/vault/copy";
import { grantsBudgetBase, liveGrants, useVaultAccount } from "@/features/vault/useVaultAccount";
import { useVaultOpenBets } from "@/features/vault/useVaultOpenBets";
import { useVaultPoolCredit } from "@/features/vault/useVaultPoolCredit";
import { useVaultWrite } from "@/features/vault/useVaultWrite";
import { deriveVaultBlocker } from "@/features/vault/vault-blocker";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, ErrorState, LoadingState, type QuoteLine } from "~/components/kit";
import { FONT, TYPE } from "~/theme";
import { AmountInput, plainAmount } from "./AmountInput";
import { money } from "./format";
import { IdleYield } from "./IdleYield";
import { SignSheet } from "./SignSheet";
import { usePlateInk } from "./usePlateInk";
import { fromTx, useSignFlow } from "./useSignFlow";

const DEFAULT_AMOUNT = "1";

type Pending =
  | { kind: "vault-deposit"; amountBase: bigint }
  | { kind: "vault-withdraw"; amountBase: bigint }
  | { kind: "vault-withdraw-private"; amountBase: bigint }
  | { kind: "vault-revoke"; grantId: bigint; budgetBase: bigint; label: string }
  | { kind: "vault-sweep"; credit: VenueCredit };

/** A labelled figure in the snapshot grid (web `VaultCells` Cell). */
export function Cell({ label, value, note, live }: { label: string; value: string; note?: string; live?: boolean }) {
  const ink = usePlateInk();
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.cellLabel, { color: ink.mute }]}>{label}</Text>
      <Text style={[styles.cellValue, { color: live ? ink.figure : ink.ink }]}>{value}</Text>
      {note ? <Text style={[TYPE.caption, { color: ink.mute, fontSize: 11, lineHeight: 15 }]}>{note}</Text> : null}
    </View>
  );
}

/**
 * web `TradingBalancePanel` → `TradingBalanceView`: the Trading Balance's controls folded into the plate — amount,
 * Deposit, Withdraw (the whole available balance, as web), Withdraw Private while one exists — then the snapshot cells,
 * what idle money earns, the live grants with Revoke, and the vault's own venue credit with Sweep. Every write goes
 * through web's `useVaultWrite` after a SignSheet review.
 */
export function TradingBalancePanel() {
  const session = useWalletSession();
  const account = useVaultAccount();
  const { state, run, hasSigner } = useVaultWrite();
  const address = account.kind === "connected" ? account.address : null;
  const snapshot = account.kind === "connected" && account.reading && isOk(account.reading) ? account.reading.value : null;
  const openBets = useVaultOpenBets(address);
  const poolCredit = useVaultPoolCredit(snapshot?.deployment ?? null);
  const flow = useSignFlow();
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const ink = usePlateInk();

  if (account.kind !== "connected") return null;
  const reading = account.reading;
  if (reading === null) return <LoadingState shape="row" />;
  if (!reading.ok) return <ErrorState diagnosis={reading.error} retry={account.retry} />;
  if (reading.value === null) {
    return (
      <View style={styles.panel}>
        <Text style={[TYPE.body, { color: ink.ink }]}>{VAULT.notDeployed.why}</Text>
      </View>
    );
  }

  const { decimals, account: vault } = reading.value;
  const symbol = account.symbol ?? "tUSDC";
  const wallet = account.walletSpendableBase;
  const grants = liveGrants(reading.value);
  const blocker = deriveVaultBlocker({ session, hasSigner, busy: state.busy !== null, gasShort: state.gasShort });
  const open = openBets && isOk(openBets)
    ? { count: openBets.value.length, stakeBase: openBets.value.reduce<bigint | null>((sum, bet) => (sum === null || bet.stakeBase === null ? null : sum + bet.stakeBase), 0n) }
    : null;

  // Untouched, the default never asks for more than the wallet holds (web `VaultControls`).
  const oneBase = parseDecimalToBaseUnits(DEFAULT_AMOUNT, decimals) ?? 0n;
  const amount = typed ?? (wallet !== null && wallet > 0n && oneBase > wallet ? plainAmount(wallet, decimals) : DEFAULT_AMOUNT);
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocked = blocker !== null || state.busy !== null;
  const depositDisabled = blocked || amountBase <= 0n || wallet === null || wallet < amountBase;
  const withdrawDisabled = blocked || vault.availableBase <= 0n;
  const m = (base: bigint) => money(base, decimals, symbol);

  const ask = (next: Pending) => {
    setPending(next);
    flow.start();
  };

  const review = reviewOf(pending, { m, wallet, available: vault.availableBase, privateBase: vault.privateAvailableBase });
  const confirm = () => {
    if (!pending) return;
    const intent: VaultIntent =
      pending.kind === "vault-revoke" ? { kind: "vault-revoke", grantId: pending.grantId }
      : pending.kind === "vault-sweep" ? { kind: "vault-sweep", pool: pending.credit.marketId }
      : { kind: pending.kind, amountBase: pending.amountBase };
    void flow.run(async () => fromTx(await run(intent, review.landed), review.landed));
  };

  return (
    <View style={styles.panel}>
      <Text style={[styles.eyebrow, { color: ink.mute }]}>{VAULT.eyebrow}</Text>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{VAULT.note}</Text>

      <AmountInput value={amount} onChange={setTyped} decimals={decimals} symbol={symbol} maxBase={wallet} label={VAULT.amountLabel} />
      <View style={styles.buttons}>
        <Button label={state.busy === "vault-deposit" ? VAULT.depositing : VAULT.deposit} disabled={depositDisabled} onPress={() => ask({ kind: "vault-deposit", amountBase })} style={styles.grow} />
        <Button label={state.busy === "vault-withdraw" ? VAULT.withdrawing : VAULT.withdraw} variant="outline" disabled={withdrawDisabled} onPress={() => ask({ kind: "vault-withdraw", amountBase: vault.availableBase })} style={styles.grow} />
      </View>
      {vault.privateAvailableBase > 0n ? (
        <Button label={state.busy === "vault-withdraw-private" ? VAULT.withdrawing : VAULT.withdrawPrivate} variant="secondary" disabled={blocked} onPress={() => ask({ kind: "vault-withdraw-private", amountBase: vault.privateAvailableBase })} />
      ) : null}
      {blocker ? <Text style={[TYPE.caption, { color: ink.mute }]}>{blockerLabel(blocker)}</Text> : null}

      <View style={styles.cells}>
        <Cell label={VAULT.cells.wallet} value={wallet === null ? VAULT.none : m(wallet)} />
        <Cell label={VAULT.cells.available} value={m(vault.availableBase)} />
        <Cell label={VAULT.cells.inTrades} value={open?.stakeBase == null ? VAULT.none : m(open.stakeBase)} live={(open?.stakeBase ?? 0n) > 0n} note={(open?.stakeBase ?? 0n) > 0n ? VAULT.cells.inTradesNote : undefined} />
        <Cell label={VAULT.cells.private} value={m(vault.privateAvailableBase)} />
        <Cell label={VAULT.cells.grants} value={grantsBudgetBase(reading.value) > 0n ? m(grantsBudgetBase(reading.value)) : VAULT.none} live={grantsBudgetBase(reading.value) > 0n} />
        <Cell label={VAULT.cells.positions} value={open === null ? VAULT.none : String(open.count)} />
      </View>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{VAULT.positionsNote}</Text>

      <IdleYield idleBase={vault.availableBase} decimals={decimals} />

      {grants.length > 0 ? (
        <View style={[styles.group, { borderTopColor: ink.line }]}>
          <Text style={[styles.eyebrow, { color: ink.mute }]}>{VAULT.grants.title}</Text>
          {grants.map((grant) => (
            <View key={grant.grantId.toString()} style={styles.grant}>
              <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{VAULT.grants.kind[grant.kind]}</Text>
              <Text style={[TYPE.caption, { color: ink.mute }]}>
                {shortHex(grant.actor)} · {VAULT.grants.budget} {m(grant.budgetBase)} · {VAULT.grants.expires} {formatUtc(grant.expiresAtSec * 1000, { withSeconds: false })}
              </Text>
              <Button
                label={state.busy === "vault-revoke" ? VAULT.grants.revoking : VAULT.grants.revoke}
                variant="outline"
                size="sm"
                block={false}
                disabled={blocked}
                onPress={() => ask({ kind: "vault-revoke", grantId: grant.grantId, budgetBase: grant.budgetBase, label: VAULT.grants.kind[grant.kind] })}
              />
            </View>
          ))}
          <Text style={[TYPE.caption, { color: ink.mute }]}>{VAULT.grants.revokeNote}</Text>
        </View>
      ) : null}

      {poolCredit.map((credit) => (
        <View key={credit.marketId} style={[styles.group, { borderTopColor: ink.line }]}>
          <Text style={[TYPE.caption, { color: ink.mute }]}>{VAULT.sweep.note(m(credit.amountBase))}</Text>
          <Button label={state.busy === "vault-sweep" ? VAULT.sweep.sweeping : VAULT.sweep.action} variant="outline" size="sm" block={false} disabled={blocked} onPress={() => ask({ kind: "vault-sweep", credit })} />
        </View>
      ))}

      <SignSheet
        visible={flow.open}
        onClose={flow.close}
        title={review.title}
        lines={review.lines}
        maxLoss={m(0n)}
        confirmLabel={review.slide}
        onConfirm={confirm}
        phase={flow.phase}
        outcome={flow.outcome}
      />
    </View>
  );
}

interface ReviewFacts {
  m: (base: bigint) => string;
  wallet: bigint | null;
  available: bigint;
  privateBase: bigint;
}

/** The exact figures each vault write moves, before and after, from the same reads the panel shows. */
function reviewOf(pending: Pending | null, { m, wallet, available, privateBase }: ReviewFacts): { title: string; lines: QuoteLine[]; slide: string; landed: string } {
  if (!pending) return { title: "", lines: [], slide: "", landed: "" };
  switch (pending.kind) {
    case "vault-deposit":
      return {
        title: `Deposit ${m(pending.amountBase)} into your Trading Balance`,
        lines: [
          { label: "From your wallet", value: m(pending.amountBase) },
          { label: "Wallet after", value: wallet === null ? "—" : m(wallet - pending.amountBase) },
          { label: "Trading Balance after", value: m(available + pending.amountBase), tone: "accent" },
        ],
        slide: "Slide to deposit",
        landed: VAULT.toasts.deposited,
      };
    case "vault-withdraw":
      return {
        title: `Withdraw ${m(pending.amountBase)} to your wallet`,
        lines: [
          { label: "From your Trading Balance", value: m(pending.amountBase) },
          { label: "Trading Balance after", value: m(available - pending.amountBase) },
          { label: "Wallet after", value: wallet === null ? "—" : m(wallet + pending.amountBase), tone: "accent" },
        ],
        slide: "Slide to withdraw",
        landed: VAULT.toasts.withdrawn,
      };
    case "vault-withdraw-private":
      return {
        title: `Withdraw ${m(pending.amountBase)} of private balance`,
        lines: [
          { label: "From your private bucket", value: m(pending.amountBase) },
          { label: "Private after", value: m(privateBase - pending.amountBase) },
          { label: "Wallet after", value: wallet === null ? "—" : m(wallet + pending.amountBase), tone: "accent" },
        ],
        slide: "Slide to withdraw",
        landed: VAULT.toasts.withdrawnPrivate,
      };
    case "vault-revoke":
      return {
        title: `Revoke the ${pending.label} grant`,
        lines: [
          { label: "Unspent budget back to your balance", value: m(pending.budgetBase), tone: "accent" },
          { label: "Positions it opened", value: "stay yours" },
        ],
        slide: "Slide to revoke",
        landed: VAULT.toasts.revoked,
      };
    case "vault-sweep":
      return {
        title: "Sweep the vault's venue credit",
        lines: [{ label: "Credit swept back into the vault", value: m(pending.credit.amountBase), tone: "accent" }],
        slide: "Slide to sweep",
        landed: VAULT.toasts.swept,
      };
  }
}

const styles = StyleSheet.create({
  panel: { gap: 12, paddingTop: 4 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
  buttons: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  cells: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  cell: { width: "50%", gap: 2, paddingRight: 8 },
  cellLabel: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" },
  cellValue: { fontFamily: FONT.data, fontSize: 15, fontVariant: ["tabular-nums"] },
  group: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  grant: { gap: 6 },
});
