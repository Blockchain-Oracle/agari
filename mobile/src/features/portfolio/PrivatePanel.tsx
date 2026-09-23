import { blockerLabel } from "@agari/core/copy";
import type { PrivateIntent } from "@agari/core/private";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, parseDecimalToBaseUnits, shortHex } from "@agari/core/units";
import { useBalanceSheet, usePrivateBudget, usePrivateDesk } from "@agari/markets/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { PRIVATE } from "@/features/private/copy";
import { usePrivateWrites } from "@/features/private/usePrivateWrites";
import { deriveVaultBlocker } from "@/features/vault/vault-blocker";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, ErrorState, LoadingState, type QuoteLine } from "~/components/kit";
import { FONT, TYPE } from "~/theme";
import { AmountInput, plainAmount } from "./AmountInput";
import { money } from "./format";
import { PrivateClaimsList } from "./PrivateClaimsList";
import { SignSheet } from "./SignSheet";
import { Cell } from "./TradingBalancePanel";
import { usePlateInk } from "./usePlateInk";
import { fromTx, useSignFlow } from "./useSignFlow";

const DEFAULT_AMOUNT = "5";

/**
 * web `PrivateBalancePanel` behind the plate's Private row: the Trading Balance grammar over the desk's own numbers —
 * Deposit (allows the desk the whole new balance), Withdraw (all of it), Revoke (stops private bets, the money stays)
 * — then the cells, the trust sentences, and the private positions this phone holds the proofs for.
 */
export function PrivatePanel() {
  const session = useWalletSession();
  const { address } = session;
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const deskReading = usePrivateDesk();
  const budgetReading = usePrivateBudget(address);
  const sheet = useBalanceSheet(address);
  const writes = usePrivateWrites();
  const flow = useSignFlow();
  const [typed, setTyped] = useState<string | null>(null);
  const [pending, setPending] = useState<PrivateIntent | null>(null);
  const ink = usePlateInk();

  if (!address) return null;
  if (deskReading === null) return <LoadingState shape="row" />;
  if (!isOk(deskReading)) return <ErrorState diagnosis={deskReading.error} />;
  const desk = deskReading.value;
  if (!desk) {
    return (
      <View style={styles.panel}>
        <Text style={[TYPE.body, { color: ink.ink }]}>{PRIVATE.notDeployed.why}</Text>
      </View>
    );
  }

  const decimals = desk.decimals;
  const budget = budgetReading && isOk(budgetReading) ? budgetReading.value : null;
  const wallet = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const fiveBase = parseDecimalToBaseUnits(DEFAULT_AMOUNT, decimals) ?? 0n;
  const amount = typed ?? (wallet !== null && wallet > 0n && fiveBase > wallet ? plainAmount(wallet, decimals) : DEFAULT_AMOUNT);
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocker = deriveVaultBlocker({ session, hasSigner: writes.hasSigner, busy: writes.state.busy !== null, gasShort: writes.state.gasShort });
  const busy = writes.state.busy;
  const depositDisabled = blocker !== null || amountBase <= 0n || wallet === null || wallet < amountBase || budget === null;
  const withdrawDisabled = blocker !== null || !budget || budget.balanceBase <= 0n;
  const revokeDisabled = blocker !== null || !budget || budget.allowanceBase <= 0n;
  const m = (base: bigint) => money(base, decimals, symbol);

  const ask = (intent: PrivateIntent) => {
    setPending(intent);
    flow.start();
  };
  const review = reviewOf(pending, m, budget?.balanceBase ?? 0n, wallet);
  const confirm = () => {
    if (!pending) return;
    void flow.run(async () => fromTx(await writes.run(pending, review.landed), review.landed));
  };

  return (
    <View style={styles.panel}>
      <Text style={[styles.eyebrow, { color: ink.mute }]}>{PRIVATE.panel.eyebrow}</Text>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{PRIVATE.panel.note}</Text>
      <AmountInput value={amount} onChange={setTyped} decimals={decimals} symbol={symbol} maxBase={wallet} label={PRIVATE.panel.amountLabel} />
      <View style={styles.buttons}>
        <Button
          label={busy === "private-deposit-and-allow" ? PRIVATE.panel.depositing : PRIVATE.panel.deposit}
          disabled={depositDisabled}
          onPress={() => budget && ask({ kind: "private-deposit-and-allow", amountBase, allowanceBase: budget.balanceBase + amountBase })}
          style={styles.grow}
        />
        <Button
          label={busy === "private-withdraw" ? PRIVATE.panel.withdrawing : PRIVATE.panel.withdraw}
          variant="outline"
          disabled={withdrawDisabled}
          onPress={() => budget && ask({ kind: "private-withdraw", amountBase: budget.balanceBase })}
          style={styles.grow}
        />
      </View>
      <Button
        label={busy === "private-revoke" ? PRIVATE.panel.revoking : PRIVATE.panel.revoke}
        variant="secondary"
        disabled={revokeDisabled}
        onPress={() => ask({ kind: "private-revoke" })}
      />
      <Text style={[TYPE.caption, { color: ink.mute }]}>{blocker ? blockerLabel(blocker) : PRIVATE.panel.allowanceNote}</Text>

      <View style={styles.cells}>
        <Cell label={PRIVATE.panel.cells.balance} value={budget ? m(budget.balanceBase) : "—"} />
        <Cell label={PRIVATE.panel.cells.allowance} value={budget ? m(budget.allowanceBase) : "—"} />
        <Cell label={PRIVATE.panel.cells.spendable} value={budget ? m(budget.spendableBase) : "—"} live={(budget?.spendableBase ?? 0n) > 0n} />
        <Cell label={PRIVATE.panel.cells.desk} value={shortHex(desk.desk)} />
        <Cell label={PRIVATE.panel.cells.cap} value={`${formatBaseUnits(desk.params.maxStakeBase, decimals, { minDp: 0 })} ${symbol}`} />
      </View>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{PRIVATE.panel.trust}</Text>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{PRIVATE.panel.correlation}</Text>

      <PrivateClaimsList owner={address} pinnedDesk={desk.desk} contract={desk.deployment.privateDesk} chainId={desk.deployment.chainId} decimals={decimals} symbol={symbol} />

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

/** The exact figures each desk write moves, from the same reads the cells show. */
function reviewOf(pending: PrivateIntent | null, m: (base: bigint) => string, balance: bigint, wallet: bigint | null): { title: string; lines: QuoteLine[]; slide: string; landed: string } {
  if (pending?.kind === "private-deposit-and-allow") {
    return {
      title: `Deposit ${m(pending.amountBase)} into your private balance`,
      lines: [
        { label: "From your wallet", value: m(pending.amountBase) },
        { label: "Private balance after", value: m(balance + pending.amountBase), tone: "accent" },
        { label: "Desk may spend", value: m(pending.allowanceBase), hint: PRIVATE.panel.allowanceNote },
      ],
      slide: "Slide to deposit",
      landed: PRIVATE.toasts.deposited,
    };
  }
  if (pending?.kind === "private-withdraw") {
    return {
      title: `Withdraw ${m(pending.amountBase)} to your wallet`,
      lines: [
        { label: "From your private balance", value: m(pending.amountBase) },
        { label: "Wallet after", value: wallet === null ? "—" : m(wallet + pending.amountBase), tone: "accent" },
      ],
      slide: "Slide to withdraw",
      landed: PRIVATE.toasts.withdrawn,
    };
  }
  return {
    title: "Revoke the desk's allowance",
    lines: [{ label: "Your private balance", value: `${m(balance)} · stays yours` }],
    slide: "Slide to revoke",
    landed: PRIVATE.toasts.revoked,
  };
}

const styles = StyleSheet.create({
  panel: { gap: 12, paddingTop: 4 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
  buttons: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  cells: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
});
