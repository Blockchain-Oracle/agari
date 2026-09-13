"use client";

import { formatBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import { isOk } from "@masayume/core/schemas";
import { useBalanceSheet, useWalletCollateral } from "@masayume/markets/react";
import type { Address, Hex } from "@masayume/core/types";
import type { useFaucet } from "@/features/markets/faucet/useFaucet";
import { FUNDING } from "./copy";

export function FundingProgress({ address, faucet }: { address: Address; faucet: ReturnType<typeof useFaucet> }) {
  const balances = useWalletCollateral(address);
  const sheet = useBalanceSheet(address);
  const token = balances && isOk(balances) ? balances.value : null;
  const gas = faucet.gasStatus;
  const native = gas?.walletBalanceWei ?? (sheet?.ok && !sheet.stale ? sheet.value.nativeWei : null);
  const localClaim = faucet.state.gasClaim;
  const claim = gas?.claim && gas.claim.id === localClaim?.id && gas.claim.status !== "prepared" ? gas.claim : localClaim ?? gas?.claim;
  return <div className="fund-progress" aria-live="polite">
    <dl className="fund-balances">
      <div><dt>STT for network gas</dt><dd>{native != null ? `${formatBaseUnits(BigInt(native), 18, { maxDp: 4 })} STT` : "Balance unavailable"}</dd></div>
      <div><dt>tUSDC for trading</dt><dd>{token ? `${formatBaseUnits(token.amountBase, token.decimals)} ${token.symbol}${balances?.ok && balances.stale ? " · last known" : ""}` : balances === null ? "Checking balance…" : "Balance unavailable"}</dd></div>
    </dl>
    <p className="fund-foot-line">{FUNDING.modal.gasPolicy}</p>
    <p className="fund-foot-line">{gas?.message ?? (faucet.gasStatusUnavailable ? "Gas availability could not be checked. Retry or use an external STT faucet." : "Checking STT first. The tUSDC claim follows once you have gas.")}</p>
    {faucet.busy && <p className="fund-msg">{faucet.label}</p>}
    {faucet.state.error && <p className="fund-msg fund-msg--err" role="alert">{faucet.state.error}</p>}
    {claim && <a className="fund-foot-link" href={txUrl(claim.txHash as Hex)} target="_blank" rel="noreferrer">STT top-up · {claim.status === "confirmed" ? "confirmed" : claim.status === "prepared" ? "confirming" : "needs attention"} ↗</a>}
    {claim && claim.status !== "prepared" && claim.nextClaimAtMs > Date.now() && <p className="fund-foot-line">Next gas request: {new Date(claim.nextClaimAtMs).toLocaleString()}</p>}
  </div>;
}
