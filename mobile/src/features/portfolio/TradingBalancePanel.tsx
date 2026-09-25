import { blockerLabel } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, formatUtc, parseDecimalToBaseUnits, shortHex } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { VAULT } from "@/features/vault/copy";
import { grantsBudgetBase, liveGrants, useVaultAccount } from "@/features/vault/useVaultAccount";
import { useVaultOpenBets } from "@/features/vault/useVaultOpenBets";
import { useVaultPoolCredit } from "@/features/vault/useVaultPoolCredit";
import { useVaultWrite } from "@/features/vault/useVaultWrite";
import { deriveVaultBlocker } from "@/features/vault/vault-blocker";
import { useWalletSession } from "@/lib/wallet-session";
import { ErrorState, LoadingState } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { usePlateInk } from "./usePlateInk";
import { IdleYieldNote } from "./vault/IdleYieldNote";
import { AmountField, Cell, VaultButton, vaultStyles } from "./vault/parts";

const DEFAULT_AMOUNT = "1";
const plain = (base: bigint, decimals: number) => formatBaseUnits(base, decimals, { minDp: 0 }).replace(/,/g, "");

/**
 * web `TradingBalancePanel inline` → `TradingBalanceView` + `VaultControls` / `VaultCells` / `VaultGrants` (vault.css,
 * remapped to the plate's inks as `.plate-rows .vault-panel`): eyebrow and sentence, amount, Deposit / Withdraw /
 * Withdraw Private, the snapshot cells, what idle money earns, the live grants with Revoke, the vault's credit with Sweep.
 * Every write goes straight to web's `useVaultWrite`, as web's buttons do.
 */
export function TradingBalancePanel() {
  const ink = usePlateInk();
  const session = useWalletSession();
  const account = useVaultAccount();
  const { state, run, hasSigner } = useVaultWrite();
  const address = account.kind === "connected" ? account.address : null;
  const snapshot = account.kind === "connected" && account.reading && isOk(account.reading) ? account.reading.value : null;
  const openBets = useVaultOpenBets(address);
  const poolCredit = useVaultPoolCredit(snapshot?.deployment ?? null);
  const [typed, setTyped] = useState<string | null>(null);

  if (account.kind !== "connected") return null;
  const reading = account.reading;
  if (reading === null) return <LoadingState shape="row" style={styles.panel} />;
  if (!reading.ok) return <ErrorState diagnosis={reading.error} retry={account.retry} style={styles.panel} />;
  if (reading.value === null) {
    return (
      <View style={styles.panel}>
        <Text style={[WEB_TYPE.body, { color: ink.ink }]}>{VAULT.notDeployed.why}</Text>
        <Text style={[WEB_TYPE.caption, styles.mt4, { color: ink.mute }]}>{VAULT.notDeployed.how}</Text>
      </View>
    );
  }

  const { decimals, account: vault } = reading.value;
  const symbol = account.symbol ?? "tUSDC";
  const wallet = account.walletSpendableBase;
  const grants = liveGrants(reading.value);
  const budget = grantsBudgetBase(reading.value);
  const blocker = deriveVaultBlocker({ session, hasSigner, busy: state.busy !== null, gasShort: state.gasShort });
  const open =
    openBets && isOk(openBets)
      ? { count: openBets.value.length, stakeBase: openBets.value.reduce<bigint | null>((sum, bet) => (sum === null || bet.stakeBase === null ? null : sum + bet.stakeBase), 0n) }
      : null;
  const oneBase = parseDecimalToBaseUnits(DEFAULT_AMOUNT, decimals) ?? 0n;
  const amount = typed ?? (wallet !== null && wallet > 0n && oneBase > wallet ? plain(wallet, decimals) : DEFAULT_AMOUNT);
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocked = blocker !== null || state.busy !== null;
  const depositDisabled = blocked || amountBase <= 0n || wallet === null || wallet < amountBase;
  const withdrawDisabled = blocked || vault.availableBase <= 0n;
  const m = (base: bigint) => formatBaseUnits(base, decimals);

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View>
          <Text style={[vaultStyles.eyebrow, { color: ink.mute }]}>{VAULT.eyebrow}</Text>
          <Text style={[vaultStyles.note, { color: ink.mute }]}>{VAULT.note}</Text>
        </View>
        <View style={styles.controlsWrap}>
          <View style={styles.controls}>
            <AmountField value={amount} onChange={setTyped} decimals={decimals} symbol={symbol} maxBase={wallet} label={VAULT.amountLabel} />
            <View style={styles.buttons}>
              <VaultButton
                label={state.busy === "vault-deposit" ? VAULT.depositing : VAULT.deposit}
                kind="primary"
                grow
                disabled={depositDisabled}
                onPress={() => void run({ kind: "vault-deposit", amountBase }, VAULT.toasts.deposited)}
              />
              <VaultButton
                label={state.busy === "vault-withdraw" ? VAULT.withdrawing : VAULT.withdraw}
                kind="outline"
                grow
                disabled={withdrawDisabled}
                onPress={() => void run({ kind: "vault-withdraw", amountBase: vault.availableBase }, VAULT.toasts.withdrawn)}
              />
            </View>
            {vault.privateAvailableBase > 0n ? (
              <VaultButton
                label={state.busy === "vault-withdraw-private" ? VAULT.withdrawing : VAULT.withdrawPrivate}
                kind="private"
                disabled={blocked}
                onPress={() => void run({ kind: "vault-withdraw-private", amountBase: vault.privateAvailableBase }, VAULT.toasts.withdrawnPrivate)}
              />
            ) : null}
          </View>
          {blocker ? <Text style={[vaultStyles.caption, { color: ink.mute }]}>{blockerLabel(blocker)}</Text> : null}
        </View>
      </View>

      <View style={[styles.cells, { borderTopColor: ink.line }]}>
        <Cell label={VAULT.cells.wallet} value={wallet === null ? VAULT.none : m(wallet)} />
        <Cell label={VAULT.cells.available} value={m(vault.availableBase)} />
        <Cell
          label={VAULT.cells.inTrades}
          value={open?.stakeBase == null ? VAULT.none : m(open.stakeBase)}
          live={(open?.stakeBase ?? 0n) > 0n}
          note={(open?.stakeBase ?? 0n) > 0n ? VAULT.cells.inTradesNote : undefined}
        />
        <Cell label={VAULT.cells.private} value={m(vault.privateAvailableBase)} />
        <Cell label={VAULT.cells.grants} value={budget > 0n ? m(budget) : VAULT.none} live={budget > 0n} />
        <Cell label={VAULT.cells.positions} value={open === null ? VAULT.none : String(open.count)} />
      </View>
      <Text style={[styles.loading, { color: ink.mute }]}>{VAULT.positionsNote}</Text>

      <IdleYieldNote idleBase={vault.availableBase} decimals={decimals} />

      {grants.length > 0 ? (
        <View style={[styles.grants, { borderTopColor: ink.line }]} accessibilityLabel={VAULT.grants.title}>
          <Text style={[vaultStyles.eyebrow, { color: ink.mute }]}>{VAULT.grants.title}</Text>
          {grants.map((grant) => (
            <View key={grant.grantId.toString()} style={styles.grant}>
              <Text style={[WEB_TYPE.bodyStrong, { color: ink.ink }]}>{VAULT.grants.kind[grant.kind]}</Text>
              <Text style={[vaultStyles.caption, styles.mono, { color: ink.mute }]}>{shortHex(grant.actor)}</Text>
              <Text style={[vaultStyles.caption, { color: ink.mute }]}>
                {VAULT.grants.budget} <Text style={WEB_TYPE.numbers}>{m(grant.budgetBase)}</Text> {symbol}
              </Text>
              <Text style={[vaultStyles.caption, WEB_TYPE.numbers, { color: ink.mute }]}>
                {VAULT.grants.expires} {formatUtc(grant.expiresAtSec * 1000, { withSeconds: false })}
              </Text>
              <View style={styles.grow} />
              <VaultButton
                label={state.busy === "vault-revoke" ? VAULT.grants.revoking : VAULT.grants.revoke}
                kind="outline"
                disabled={blocker !== null || state.busy !== null}
                onPress={() => void run({ kind: "vault-revoke", grantId: grant.grantId }, VAULT.toasts.revoked)}
              />
            </View>
          ))}
          <Text style={[vaultStyles.caption, { color: ink.mute }]}>{VAULT.grants.revokeNote}</Text>
        </View>
      ) : null}

      {poolCredit.map((credit) => (
        <View key={credit.marketId} style={[styles.grants, styles.grant, { borderTopColor: ink.line }]}>
          <Text style={[vaultStyles.caption, { color: ink.mute }]}>{VAULT.sweep.note(`${m(credit.amountBase)} ${symbol}`)}</Text>
          <VaultButton
            label={state.busy === "vault-sweep" ? VAULT.sweep.sweeping : VAULT.sweep.action}
            kind="outline"
            disabled={blocker !== null || state.busy !== null}
            onPress={() => void run({ kind: "vault-sweep", pool: credit.marketId }, VAULT.toasts.swept)}
          />
        </View>
      ))}
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
  cells: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 14, paddingTop: 16, marginTop: 16, borderTopWidth: 1 },
  loading: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  grants: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  grant: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", rowGap: 6, columnGap: 12 },
  mono: { fontFamily: FONT.dataRegular },
  grow: { flexGrow: 1 },
});
