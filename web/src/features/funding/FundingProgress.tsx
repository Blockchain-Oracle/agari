"use client";

import type { FaucetClaimStatus } from "@agari/core/faucet";
import { formatBaseUnits } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { isOk } from "@agari/core/schemas";
import { useBalanceSheet, useWalletCollateral } from "@agari/markets/react";
import { isSignature, type Address } from "@agari/core/types";
import type { useFaucet } from "@/features/markets/faucet/useFaucet";
import { webEnv } from "@/lib/env";
import { FUNDING } from "./copy";

/** 1 SOL = 10⁹ lamports. */
const SOL_DECIMALS = 9;
const claimLabel = (status: FaucetClaimStatus) => status === "confirmed" ? "confirmed" : status === "prepared" ? "confirming" : "needs attention";

export function FundingProgress({ address, faucet }: { address: Address; faucet: ReturnType<typeof useFaucet> }) {
  const balances = useWalletCollateral(address);
  const sheet = useBalanceSheet(address);
  const token = balances && isOk(balances) ? balances.value : null;
  const gas = faucet.gasStatus;
  const native = gas?.walletBalanceLamports ?? (sheet?.ok && !sheet.stale ? sheet.value.nativeLamports : null);
  const localClaim = faucet.state.gasClaim;
  const claim = gas?.claim && gas.claim.id === localClaim?.id && gas.claim.status !== "prepared" ? gas.claim : localClaim ?? gas?.claim;
  const localMint = faucet.state.mintClaim;
  const mintClaim = gas?.tusdc.claim && gas.tusdc.claim.id === localMint?.id && gas.tusdc.claim.status !== "prepared" ? gas.tusdc.claim : localMint ?? gas?.tusdc.claim;
  // The tUSDC line speaks only when it adds something: a claim on record, or a reason the mint can't run now.
  const mintNote = gas?.configured && (!gas.tusdc.ready || gas.tusdc.claim) ? gas.tusdc.message : null;
  return <div className="fund-progress" aria-live="polite">
    <dl className="fund-balances">
      <div><dt>SOL for network fees</dt><dd>{native != null ? `${formatBaseUnits(BigInt(native), SOL_DECIMALS, { maxDp: 4 })} SOL` : "Balance unavailable"}</dd></div>
      <div><dt>tUSDC for trading</dt><dd>{token ? `${formatBaseUnits(token.amountBase, token.decimals)} ${token.symbol}${balances?.ok && balances.stale ? " · last known" : ""}` : balances === null ? "Checking balance…" : "Balance unavailable"}</dd></div>
    </dl>
    <p className="fund-foot-line">{FUNDING.modal.gasPolicy}</p>
    <p className="fund-foot-line">{gas?.message ?? (faucet.gasStatusUnavailable ? "SOL availability could not be checked. Retry or use an external SOL faucet." : "Checking SOL first. Your tUSDC follows with the same signature.")}</p>
    {mintNote && <p className="fund-foot-line">{mintNote}</p>}
    {faucet.busy && <p className="fund-msg">{faucet.label}</p>}
    {faucet.state.error && <p className="fund-msg fund-msg--err" role="alert">{faucet.state.error}</p>}
    {claim && isSignature(claim.txHash) && <a className="fund-foot-link" href={txUrl(claim.txHash, webEnv.markets.cluster)} target="_blank" rel="noreferrer">SOL top-up · {claimLabel(claim.status)} ↗</a>}
    {claim && claim.status !== "prepared" && claim.nextClaimAtMs > Date.now() && <p className="fund-foot-line">Next SOL request: {new Date(claim.nextClaimAtMs).toLocaleString()}</p>}
    {mintClaim && isSignature(mintClaim.txHash) && <a className="fund-foot-link" href={txUrl(mintClaim.txHash, webEnv.markets.cluster)} target="_blank" rel="noreferrer">tUSDC claim · {claimLabel(mintClaim.status)} ↗</a>}
    {mintClaim && mintClaim.status !== "prepared" && mintClaim.nextClaimAtMs > Date.now() && <p className="fund-foot-line">Next tUSDC claim: {new Date(mintClaim.nextClaimAtMs).toLocaleString()}</p>}
  </div>;
}
