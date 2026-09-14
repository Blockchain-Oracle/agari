"use client";

import { FAUCET_UNITS, FEE_RESERVE_LAMPORTS } from "@agari/core/constants";
import type { FaucetClaimView, FaucetStatus, TusdcFaucetClaimView } from "@agari/core/faucet";
import type { WritePhase } from "@agari/core/ports";
import type { Diagnosis, Signature } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { announceCredit } from "@/features/funding/credited";
import { FUNDING_STAGE_LABEL, PendingClaimError, fundsRequest, readGasStatus, type FundingStage } from "@/features/funding/gas-client";
import { FAUCET } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { signText, useOwnerWallet, useWalletSession } from "@/lib/wallet-session";

export interface FaucetState {
  phase: WritePhase;
  diagnosis: Diagnosis | null;
  txHash: Signature | null;
  gasShort: boolean;
  checkingGas: boolean;
  stage: FundingStage;
  error: string | null;
  gasClaim: FaucetClaimView | null;
  /** The server-sent tUSDC mint of this run (D-034). */
  mintClaim: TusdcFaucetClaimView | null;
}
const IDLE: FaucetState = { phase: "composing", diagnosis: null, txHash: null, gasShort: false, checkingGas: false, stage: "idle", error: null, gasClaim: null, mintClaim: null };
const running = new Set<string>();
const rejected = (error: unknown) => error instanceof Error && /reject|denied|cancel/i.test(error.message);

export function useFaucet() {
  const submitter = useSubmitter();
  const { address, hasSigner } = useSigner();
  const wallet = useWalletSession();
  const owner = useOwnerWallet();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FaucetState>(IDLE);
  // Base58 is case-sensitive, and a Solana wallet has no chain to switch: the address alone binds a run (D-010).
  const binding = `${wallet.address}`;
  const currentBinding = useRef(binding);
  currentBinding.current = binding;
  useEffect(() => setState(IDLE), [binding]);
  const status = useQuery({ queryKey: ["faucet-status", wallet.address], queryFn: () => readGasStatus(wallet.address!), enabled: Boolean(wallet.address && wallet.isRightChain), staleTime: 10_000, retry: false });
  const busy = !["idle", "ready"].includes(state.stage);

  const recheckGas = useCallback(async (): Promise<boolean> => {
    if (!submitter) return false;
    setState((s) => ({ ...s, checkingGas: true }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const gas = await Promise.race([submitter.checkGas("faucet"), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("The SOL balance check timed out. Please retry or use an external SOL faucet.")), 15_000); })]);
      if (currentBinding.current === binding) setState((s) => ({ ...s, checkingGas: false, diagnosis: gas.ok ? null : gas.diagnosis, gasShort: !gas.ok && gas.diagnosis.kind === "out-of-gas" }));
      return gas.ok;
    } finally { clearTimeout(timer); if (currentBinding.current === binding) setState((s) => ({ ...s, checkingGas: false })); }
  }, [submitter, binding]);

  /** One run: a free signature, the SOL top-up when eligible, then the server-sent tUSDC mint. No transaction popup. */
  const mint = useCallback(async () => {
    if (!address || !wallet.isRightChain || wallet.address !== address || running.has(address)) return;
    if (!submitter) { setState((s) => ({ ...s, error: "Your wallet connection is still getting ready. Please retry." })); return; }
    running.add(address);
    const current = () => currentBinding.current === binding;
    const stage = (stage: FundingStage) => { if (current()) setState((s) => ({ ...s, stage })); };
    const readFunding = async (): Promise<FaucetStatus | null> => {
      const funding = await readGasStatus(address).catch(() => null);
      if (funding && current()) queryClient.setQueryData(["faucet-status", wallet.address], funding);
      return funding;
    };
    const checkFundingGas = async (funding: FaucetStatus | null) => {
      if (funding?.walletBalanceLamports == null) return recheckGas();
      const enough = BigInt(funding.walletBalanceLamports) >= FEE_RESERVE_LAMPORTS;
      if (current()) setState((s) => ({ ...s, gasShort: !enough, diagnosis: null }));
      return enough;
    };
    let request: ReturnType<typeof fundsRequest> | null = null;
    setState((s) => ({ ...s, error: null, diagnosis: null, stage: "checking", phase: s.phase === "unknown" ? "composing" : s.phase }));
    try {
      let funding = await readFunding();
      if (!current()) return;
      if (!funding?.configured) {
        await checkFundingGas(funding).catch(() => false);
        throw new Error(funding?.message ?? "In-app test funds are unavailable. Use an external SOL faucet below.");
      }
      let enoughGas = await checkFundingGas(funding);
      if (!current()) return;
      request = fundsRequest({ wallet: address, status: funding, current, stage, sign: (message) => { if (!owner || owner.address !== address) throw new Error("Wallet changed. Open test funds again for the connected wallet."); return signText(owner, message); } });
      const low = funding.walletBalanceLamports != null && BigInt(funding.walletBalanceLamports) < BigInt(funding.thresholdLamports);
      const cooling = funding.claim && funding.claim.nextClaimAtMs > Date.now() && funding.claim.status !== "prepared";
      let gasError: unknown = null;
      let gasAdded = false;
      if (funding.claim?.status === "prepared" || (low && funding.ready && !cooling)) {
        try {
          await request.claim("sol", (gasClaim) => { if (current()) setState((s) => ({ ...s, gasClaim })); });
          gasAdded = true;
        } catch (error) {
          if (!current()) return;
          // A cancelled signature stops the run; any other SOL failure still lets the free tUSDC mint go ahead.
          if (rejected(error)) throw error;
          gasError = error;
        }
        if (!current()) return;
        funding = (await readFunding()) ?? funding;
        enoughGas = await checkFundingGas(funding);
      }
      if (!current()) return;
      const tusdc = funding.tusdc;
      const mintCooling = tusdc.claim && tusdc.claim.nextClaimAtMs > Date.now() && tusdc.claim.status !== "prepared";
      if (!tusdc.configured || !(tusdc.claim?.status === "prepared" || (tusdc.ready && !mintCooling))) {
        if (gasAdded) { setState((s) => ({ ...s, stage: "idle" })); return; }
        throw gasError ?? new Error(tusdc.message);
      }
      const mintClaim = await request.claim("tusdc", (claim) => { if (current()) setState((s) => ({ ...s, mintClaim: claim })); });
      if (!current()) return;
      await invalidateAfterWrite(queryClient, { wallet: address });
      await queryClient.invalidateQueries({ queryKey: ["faucet-status", wallet.address] });
      if (!current()) return;
      const gasMessage = gasError instanceof Error ? gasError.message : null;
      setState((s) => ({ ...IDLE, phase: "confirmed", stage: "ready", txHash: mintClaim.txHash as Signature, gasClaim: s.gasClaim, mintClaim, gasShort: !enoughGas, error: gasMessage }));
      announceCredit(address, String(FAUCET_UNITS), collateralOrNull()?.symbol ?? "tUSDC");
      notify.neutral(FAUCET.minted);
    } catch (error) {
      if (current()) setState((s) => ({ ...s, stage: "idle", phase: error instanceof PendingClaimError ? "unknown" : s.phase, error: error instanceof Error ? error.message : "The request could not finish. Please retry." }));
    } finally { request?.finish(); running.delete(address); }
  }, [submitter, address, wallet.address, wallet.isRightChain, binding, recheckGas, queryClient, owner]);

  const resetCompleted = useCallback(() => setState((s) => s.phase === "confirmed" ? IDLE : s), []);
  const retryGas = useCallback(async () => {
    try { return await recheckGas(); } catch (error) {
      if (currentBinding.current === binding) setState((s) => ({ ...s, error: error instanceof Error ? error.message : "The SOL balance could not be checked." }));
      return false;
    }
  }, [recheckGas, binding]);
  return { state, mint, recheckGas: retryGas, resetCompleted, hasSigner: hasSigner && wallet.isRightChain, busy, label: FUNDING_STAGE_LABEL[state.stage], gasStatus: status.data ?? null, gasStatusUnavailable: status.isError };
}
