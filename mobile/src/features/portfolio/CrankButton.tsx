import { formatCadence } from "@agari/core/copy";
import type { SettledRound } from "@agari/core/projection";
import { VAULT } from "@/features/vault/copy";
import { useVaultWrite } from "@/features/vault/useVaultWrite";
import { Button } from "~/components/kit";
import { money } from "./format";
import { SignSheet } from "./SignSheet";
import { fromTx, useSignFlow } from "./useSignFlow";

/**
 * web's vault crank (`HistoryRow` / `VaultCreditRows`): a settled Window the Trading Balance still holds, settled into
 * it by the permissionless `vault-crank-settle` through web's `useVaultWrite`, after a review of what it credits.
 */
export function CrankButton({ round, symbol }: { round: SettledRound; symbol: string | undefined }) {
  const vault = useVaultWrite();
  const flow = useSignFlow();
  const owner = vault.address;
  if (!owner) return null;
  const confirm = () =>
    void flow.run(async () => fromTx(await vault.run({ kind: "vault-crank-settle", owner, marketId: round.marketId }, VAULT.rounds.cranked), VAULT.rounds.cranked));
  return (
    <>
      <Button label={vault.state.busy === "vault-crank-settle" ? VAULT.rounds.cranking : VAULT.rounds.crank} size="sm" block={false} disabled={vault.state.busy !== null} onPress={flow.start} />
      <SignSheet
        visible={flow.open}
        onClose={flow.close}
        title={`${VAULT.rounds.crank} · ${round.asset} ${formatCadence(round.intervalSec)}`}
        lines={[{ label: "Credited to your Trading Balance", value: money(round.payoutBase, round.decimals, symbol), tone: "accent", hint: VAULT.rounds.crankNote }]}
        maxLoss={money(0n, round.decimals, symbol)}
        confirmLabel="Slide to settle"
        onConfirm={confirm}
        phase={flow.phase}
        outcome={flow.outcome}
      />
    </>
  );
}
