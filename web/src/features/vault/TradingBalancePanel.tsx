"use client";

import { isOk } from "@agari/core/schemas";
import type { VenueCredit } from "@agari/core/types";
import { useWalletSession } from "@/lib/wallet-session";
import { VAULT } from "./copy";
import { TradingBalanceView } from "./TradingBalanceView";
import { useVaultAccount } from "./useVaultAccount";
import { useVaultOpenBets } from "./useVaultOpenBets";
import { useVaultPoolCredit } from "./useVaultPoolCredit";
import { useVaultWrite } from "./useVaultWrite";
import { deriveVaultBlocker } from "./vault-blocker";

/** The live Trading Balance for the connected wallet: every control writes through the session's vault lane. */
export function TradingBalancePanel({ inline, className }: { inline?: boolean; className?: string }) {
  const session = useWalletSession();
  const account = useVaultAccount();
  const { state, run, hasSigner } = useVaultWrite();
  const address = account.kind === "connected" ? account.address : null;
  const snapshot = account.kind === "connected" && account.reading && isOk(account.reading) ? account.reading.value : null;
  const openBets = useVaultOpenBets(address);
  const poolCredit = useVaultPoolCredit(snapshot?.deployment ?? null);
  // SPL deposits need no token approval, so the "two signatures the first time" note never applies (D-012).
  const needsApproval = false;

  if (account.kind !== "connected") return null;
  const blocker = deriveVaultBlocker({ session, hasSigner, busy: state.busy !== null, gasShort: state.gasShort });
  const open =
    openBets && isOk(openBets) ? { count: openBets.value.length, stakeBase: openBets.value.reduce((sum, bet) => sum + bet.stakeBase, 0n) } : null;

  return (
    <TradingBalanceView
      reading={account.reading}
      symbol={account.symbol}
      walletSpendableBase={account.walletSpendableBase}
      needsApproval={needsApproval}
      open={open}
      poolCredit={poolCredit}
      blocker={blocker}
      busy={state.busy}
      onDeposit={(amountBase) => void run({ kind: "vault-deposit", amountBase }, VAULT.toasts.deposited)}
      onWithdraw={() => snapshot && void run({ kind: "vault-withdraw", amountBase: snapshot.account.availableBase }, VAULT.toasts.withdrawn)}
      onWithdrawPrivate={() => snapshot && void run({ kind: "vault-withdraw-private", amountBase: snapshot.account.privateAvailableBase }, VAULT.toasts.withdrawnPrivate)}
      onRevoke={(grantId) => void run({ kind: "vault-revoke", grantId }, VAULT.toasts.revoked)}
      onSweep={(credit: VenueCredit) => void run({ kind: "vault-sweep", pool: credit.marketId }, VAULT.toasts.swept)}
      retry={account.retry}
      inline={inline}
      className={className}
    />
  );
}
