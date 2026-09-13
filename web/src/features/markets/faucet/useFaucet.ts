"use client";

import { FAUCET_UNITS } from "@masayume/core/constants";
import type { FaucetClaimView, FaucetStatus } from "@masayume/core/faucet";
import type { WritePhase } from "@masayume/core/ports";
import type { Diagnosis, Hex } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import { collateralOrNull, loadCollateral, requiredGasWei } from "@masayume/markets";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@masayume/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSignMessage } from "wagmi";
import { announceCredit } from "@/features/funding/credited";
import { FUNDING_STAGE_LABEL, readGasStatus, requestGas, type FundingStage } from "@/features/funding/gas-client";
import { FAUCET } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";

export interface FaucetState {
  phase: WritePhase;
  diagnosis: Diagnosis | null;
  txHash: Hex | null;
  gasShort: boolean;
  checkingGas: boolean;
  stage: FundingStage;
  error: string | null;
  gasClaim: FaucetClaimView | null;
}
const IDLE: FaucetState = { phase: "composing", diagnosis: null, txHash: null, gasShort: false, checkingGas: false, stage: "idle", error: null, gasClaim: null };
const running = new Set<string>();

export function useFaucet() {
  const submitter = useSubmitter();
  const { address, hasSigner } = useSigner();
  const wallet = useWalletSession();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FaucetState>(IDLE);
  const binding = `${wallet.address?.toLowerCase()}:${wallet.chainId}`;
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
      const gas = await Promise.race([submitter.checkGas("faucet"), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("The gas balance check timed out. Please retry or use an external STT faucet.")), 15_000); })]);
      if (currentBinding.current === binding) setState((s) => ({ ...s, checkingGas: false, diagnosis: gas.ok ? null : gas.diagnosis, gasShort: !gas.ok && gas.diagnosis.kind === "out-of-gas" }));
      return gas.ok;
    } finally { clearTimeout(timer); if (currentBinding.current === binding) setState((s) => ({ ...s, checkingGas: false })); }
  }, [submitter, binding]);

  const mint = useCallback(async () => {
    if (!address || !wallet.isRightChain || wallet.address?.toLowerCase() !== address.toLowerCase() || running.has(address)) return;
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
      if (funding?.walletBalanceWei == null) return recheckGas();
      const enough = BigInt(funding.walletBalanceWei) >= requiredGasWei("faucet");
      if (current()) setState((s) => ({ ...s, gasShort: !enough, diagnosis: null }));
      return enough;
    };
    setState((s) => ({ ...s, error: null, diagnosis: null, stage: "checking" }));
    try {
      if (state.phase === "unknown") throw new Error("The previous tUSDC mint is unconfirmed. Check its transaction before requesting another mint.");
      let funding = await readFunding();
      if (!current()) return;
      let enoughGas = await checkFundingGas(funding);
      if (!current()) return;
      const low = funding?.walletBalanceWei != null && BigInt(funding.walletBalanceWei) < BigInt(funding.thresholdWei);
      const cooling = funding?.claim && funding.claim.nextClaimAtMs > Date.now() && funding.claim.status !== "prepared";
      if (funding?.configured && (funding.claim?.status === "prepared" || (low && funding.ready && !cooling))) {
        try {
          await requestGas({ wallet: address, status: funding, current, stage, sign: (message) => signMessageAsync({ message, account: address }), onClaim: (gasClaim) => { if (current()) setState((s) => ({ ...s, gasClaim })); } });
        } catch (error) {
          if (!current()) return;
          if (error instanceof Error && /reject|denied|cancel/i.test(error.message)) throw error;
          // A lost acknowledgement can follow a confirmed transfer. Re-read before deciding whether minting can continue.
          enoughGas = await checkFundingGas(await readFunding());
          if (!enoughGas) throw error;
        }
        if (!current()) return;
        funding = await readFunding();
        enoughGas = await checkFundingGas(funding);
      }
      if (!enoughGas) throw new Error(funding?.message ?? "You need STT for gas. Our gas service is unavailable; use an external faucet below.");
      if (!current()) return;
      let collateral = collateralOrNull();
      if (!collateral) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const reading = await Promise.race([loadCollateral(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 15_000); })]);
          if (reading?.ok) collateral = reading.value;
        } finally { clearTimeout(timer); }
      }
      if (!current()) return;
      if (!collateral) throw new Error("Gas is available, but the tUSDC token details could not be read. Retry once the connection recovers; any confirmed STT stays in your wallet.");
      stage("minting");
      const outcome = await submitter.submitTx({ kind: "faucet", amountBase: FAUCET_UNITS * oneUnit(collateral.decimals) }, (phase, detail) => { if (current()) setState((s) => ({ ...s, phase, txHash: detail?.txHash ?? s.txHash })); });
      if (!current()) return;
      if (outcome.status === "confirmed") {
        await invalidateAfterWrite(queryClient, { wallet: address });
        await queryClient.invalidateQueries({ queryKey: ["faucet-status", wallet.address] });
        if (!current()) return;
        setState((s) => ({ ...IDLE, phase: "confirmed", stage: "ready", txHash: outcome.txHash, gasClaim: s.gasClaim }));
        announceCredit(address, String(FAUCET_UNITS), collateral.symbol);
        notify.neutral(FAUCET.minted);
      } else setState((s) => ({ ...s, stage: "idle", phase: outcome.status === "unknown" ? "unknown" : "composing", diagnosis: outcome.diagnosis, txHash: "txHash" in outcome ? outcome.txHash ?? null : null, gasShort: outcome.diagnosis.kind === "out-of-gas" }));
    } catch (error) {
      if (current()) setState((s) => ({ ...s, stage: "idle", error: error instanceof Error ? error.message : "The request could not finish. Please retry." }));
    } finally { running.delete(address); }
  }, [submitter, address, wallet.address, wallet.isRightChain, binding, state.phase, recheckGas, queryClient, signMessageAsync]);

  const resetCompleted = useCallback(() => setState((s) => s.phase === "confirmed" ? IDLE : s), []);
  const retryGas = useCallback(async () => {
    try { return await recheckGas(); } catch (error) {
      if (currentBinding.current === binding) setState((s) => ({ ...s, error: error instanceof Error ? error.message : "The gas balance could not be checked." }));
      return false;
    }
  }, [recheckGas, binding]);
  return { state, mint, recheckGas: retryGas, resetCompleted, hasSigner: hasSigner && wallet.isRightChain, busy, label: FUNDING_STAGE_LABEL[state.stage], gasStatus: status.data ?? null, gasStatusUnavailable: status.isError };
}
