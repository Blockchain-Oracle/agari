import { blockerLabel } from "@agari/core/copy";
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
import { ErrorState, LoadingState } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { PrivateClaims } from "./private/PrivateClaims";
import { usePlateInk } from "./usePlateInk";
import { AmountField, Cell, VaultButton, vaultStyles } from "./vault/parts";

const DEFAULT_AMOUNT = "5";

/**
 * web `PrivateBalancePanel inline` behind the plate's Private row: the Trading Balance block's grammar over the desk's
 * numbers — Deposit (allows the desk the whole new balance), Withdraw (all of it), Revoke (stops private bets, the money
 * stays) — the cells, the trust sentences, then the claims list. Each button writes straight through `usePrivateWrites`.
 */
export function PrivatePanel() {
  const ink = usePlateInk();
  const session = useWalletSession();
  const { address } = session;
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const deskReading = usePrivateDesk();
  const budgetReading = usePrivateBudget(address);
  const sheet = useBalanceSheet(address);
  const writes = usePrivateWrites();
  const [typed, setTyped] = useState<string | null>(null);

  if (!address) return null;
  if (deskReading === null) return <LoadingState shape="row" style={styles.panel} />;
  if (!isOk(deskReading)) return <ErrorState diagnosis={deskReading.error} style={styles.panel} />;
  const desk = deskReading.value;
  if (!desk) {
    return (
      <View style={styles.panel}>
        <Text style={[WEB_TYPE.body, { color: ink.ink }]}>{PRIVATE.notDeployed.why}</Text>
        <Text style={[WEB_TYPE.caption, styles.mt4, { color: ink.mute }]}>{PRIVATE.notDeployed.how}</Text>
      </View>
    );
  }

  const decimals = desk.decimals;
  const budget = budgetReading && isOk(budgetReading) ? budgetReading.value : null;
  const wallet = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const fiveBase = parseDecimalToBaseUnits(DEFAULT_AMOUNT, decimals) ?? 0n;
  const amount = typed ?? (wallet !== null && wallet > 0n && fiveBase > wallet ? formatBaseUnits(wallet, decimals, { minDp: 0 }).replace(/,/g, "") : DEFAULT_AMOUNT);
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocker = deriveVaultBlocker({ session, hasSigner: writes.hasSigner, busy: writes.state.busy !== null, gasShort: writes.state.gasShort });
  const blocked = blocker !== null;
  const busy = writes.state.busy;
  const depositDisabled = blocked || amountBase <= 0n || wallet === null || wallet < amountBase || budget === null;
  const withdrawDisabled = blocked || !budget || budget.balanceBase <= 0n;
  const revokeDisabled = blocked || !budget || budget.allowanceBase <= 0n;
  const m = (base: bigint) => formatBaseUnits(base, decimals);

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View>
          <Text style={[vaultStyles.eyebrow, { color: ink.mute }]}>{PRIVATE.panel.eyebrow}</Text>
          <Text style={[vaultStyles.note, { color: ink.mute }]}>{PRIVATE.panel.note}</Text>
        </View>
        <View style={styles.controlsWrap}>
          <View style={styles.controls}>
            <AmountField value={amount} onChange={setTyped} decimals={decimals} symbol={symbol} maxBase={wallet} label={PRIVATE.panel.amountLabel} />
            <View style={styles.buttons}>
              <VaultButton
                label={busy === "private-deposit-and-allow" ? PRIVATE.panel.depositing : PRIVATE.panel.deposit}
                kind="primary"
                grow
                disabled={depositDisabled}
                onPress={() => budget && void writes.run({ kind: "private-deposit-and-allow", amountBase, allowanceBase: budget.balanceBase + amountBase }, PRIVATE.toasts.deposited)}
              />
              <VaultButton
                label={busy === "private-withdraw" ? PRIVATE.panel.withdrawing : PRIVATE.panel.withdraw}
                kind="outline"
                grow
                disabled={withdrawDisabled}
                onPress={() => budget && void writes.run({ kind: "private-withdraw", amountBase: budget.balanceBase }, PRIVATE.toasts.withdrawn)}
              />
            </View>
            <View style={styles.buttons}>
              <VaultButton
                label={busy === "private-revoke" ? PRIVATE.panel.revoking : PRIVATE.panel.revoke}
                kind="private"
                grow
                disabled={revokeDisabled}
                onPress={() => void writes.run({ kind: "private-revoke" }, PRIVATE.toasts.revoked)}
              />
              <View style={styles.cellGap} />
            </View>
          </View>
          <Text style={[vaultStyles.caption, { color: ink.mute }]}>{blocker ? blockerLabel(blocker) : PRIVATE.panel.allowanceNote}</Text>
        </View>
      </View>

      <View style={[styles.cells, { borderTopColor: ink.line }]}>
        <Cell label={PRIVATE.panel.cells.balance} value={budget ? m(budget.balanceBase) : "—"} />
        <Cell label={PRIVATE.panel.cells.allowance} value={budget ? m(budget.allowanceBase) : "—"} />
        <Cell label={PRIVATE.panel.cells.spendable} value={budget ? m(budget.spendableBase) : "—"} live={(budget?.spendableBase ?? 0n) > 0n} />
        <Cell label={PRIVATE.panel.cells.desk} value={shortHex(desk.desk)} />
        <Cell label={PRIVATE.panel.cells.cap} value={`${formatBaseUnits(desk.params.maxStakeBase, decimals, { minDp: 0 })} ${symbol}`} />
      </View>
      <Text style={[styles.loading, { color: ink.mute }]}>{PRIVATE.panel.trust}</Text>
      <Text style={[styles.loading, { color: ink.mute }]}>{PRIVATE.panel.correlation}</Text>

      <View style={[styles.grants, { borderTopColor: ink.line }]}>
        <PrivateClaims owner={address} pinnedDesk={desk.desk} contract={desk.deployment.privateDesk} chainId={desk.deployment.chainId} decimals={decimals} symbol={symbol} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingTop: 12 },
  mt4: { marginTop: 4 },
  head: { gap: 16 },
  controlsWrap: { gap: 8 },
  controls: { gap: 12 },
  buttons: { flexDirection: "row", gap: 8 },
  cellGap: { flex: 1 },
  cells: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 14, paddingTop: 16, marginTop: 16, borderTopWidth: 1 },
  loading: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  grants: { marginTop: 16, paddingTop: 12, borderTopWidth: 1 },
});
