"use client";

import type { FaucetClaimStatus } from "@agari/core/faucet";

/** The fields both claim kinds (SOL top-up, tUSDC mint) share. */
type ClaimFacts = { txHash: string; status: FaucetClaimStatus; nextClaimAtMs: number } | null | undefined;
import { isOk } from "@agari/core/schemas";
import { isSignature, type Address } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { useBalanceSheet, useWalletCollateral } from "@agari/markets/react";
import type { useFaucet } from "@/features/markets/faucet/useFaucet";
import { webEnv } from "@/lib/env";
import { FUNDING } from "./copy";

/** 1 SOL = 10⁹ lamports. */
const SOL_DECIMALS = 9;
const claimLabel = (status: FaucetClaimStatus) => status === "confirmed" ? "confirmed" : status === "prepared" ? "confirming" : "needs attention";

export interface FundingLink {
  label: string;
  href: string;
}

/** What the add-funds progress says, in order (web and the app render it): balances, the policy, the claims. */
export function useFundingProgress(address: Address, faucet: ReturnType<typeof useFaucet>) {
  const balances = useWalletCollateral(address);
  const sheet = useBalanceSheet(address);
  const token = balances && isOk(balances) ? balances.value : null;
  const gas = faucet.gasStatus;
  const native = gas?.walletBalanceLamports ?? (sheet?.ok && !sheet.stale ? sheet.value.nativeLamports : null);
  const localClaim = faucet.state.gasClaim;
  const claim = gas?.claim && gas.claim.id === localClaim?.id && gas.claim.status !== "prepared" ? gas.claim : localClaim ?? gas?.claim;
  const localMint = faucet.state.mintClaim;
  const mintClaim = gas?.tusdc.claim && gas.tusdc.claim.id === localMint?.id && gas.tusdc.claim.status !== "prepared" ? gas.tusdc.claim : localMint ?? gas?.tusdc.claim;
  const cluster = webEnv.markets.cluster;
  const link = (what: string, c: ClaimFacts): FundingLink | null =>
    c && isSignature(c.txHash) ? { label: `${what} · ${claimLabel(c.status)} ↗`, href: txUrl(c.txHash, cluster) } : null;
  const next = (what: string, c: ClaimFacts) =>
    c && c.status !== "prepared" && c.nextClaimAtMs > Date.now() ? `Next ${what}: ${new Date(c.nextClaimAtMs).toLocaleString()}` : null;
  return {
    solText: native != null ? `${formatBaseUnits(BigInt(native), SOL_DECIMALS, { maxDp: 4 })} SOL` : "Balance unavailable",
    tokenText: token ? `${formatBaseUnits(token.amountBase, token.decimals)} ${token.symbol}${balances?.ok && balances.stale ? " · last known" : ""}` : balances === null ? "Checking balance…" : "Balance unavailable",
    policy: FUNDING.modal.gasPolicy,
    gasLine: gas?.message ?? (faucet.gasStatusUnavailable ? "SOL availability could not be checked. Retry or use an external SOL faucet." : "Checking SOL first. Your tUSDC follows with the same signature."),
    mintNote: gas?.configured && (!gas.tusdc.ready || gas.tusdc.claim) ? gas.tusdc.message : null,
    busyLabel: faucet.busy ? faucet.label : null,
    error: faucet.state.error ?? null,
    solLink: link("SOL top-up", claim),
    solNext: next("SOL request", claim),
    mintLink: link("tUSDC claim", mintClaim),
    mintNext: next("tUSDC claim", mintClaim),
  };
}
