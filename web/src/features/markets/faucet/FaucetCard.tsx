"use client";

import { FAUCET_UNITS } from "@masayume/core/constants";
import { txUrl } from "@masayume/core/urls";
import { Hash } from "@/components/data";
import { BlockedButton, ErrorState } from "@/components/states";
import { FAUCET } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { deriveFaucetBlocker } from "./faucet-blocker";
import { GasRouting } from "./GasRouting";
import { useFaucet } from "./useFaucet";
import { FundingProgress } from "@/features/funding/FundingProgress";

const AMOUNT_TEXT = FAUCET_UNITS.toLocaleString("en-US");

/** One tap mints from the venue's own token faucet; every refusal names itself, never a silent no-op (FR-2). */
export function FaucetCard({ className }: { className?: string }) {
  const session = useWalletSession();
  const faucet = useFaucet();
  const { state, mint, recheckGas, hasSigner } = faucet;
  const blocker = deriveFaucetBlocker({ session, hasSigner, phase: faucet.busy ? "submitted" : state.phase, gasShort: false });
  const refusal = state.diagnosis && !state.gasShort ? state.diagnosis : null;

  return (
    <section className={cn("flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-4", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="type-title text-ink">{FAUCET.title}</h3>
        <p className="type-caption text-ink-secondary">{FAUCET.intro(AMOUNT_TEXT)}</p>
      </div>
      {session.address && <FundingProgress address={session.address} faucet={faucet} />}
      {state.gasShort && session.address && (
        <GasRouting address={session.address} onRecheck={() => void recheckGas()} checking={state.checkingGas} />
      )}
      {refusal && <ErrorState diagnosis={refusal} retry={() => void mint()} />}
      {state.phase === "confirmed" && state.txHash && (
        <p className="type-caption text-ink-secondary">
          {FAUCET.minted} · <Hash value={state.txHash} href={txUrl(state.txHash)} className="text-ink" />
        </p>
      )}
      <BlockedButton blocker={blocker} onClick={() => void mint()} size="lg" className="w-full">
        {faucet.busy ? faucet.label : FAUCET.cta(AMOUNT_TEXT)}
      </BlockedButton>
    </section>
  );
}
