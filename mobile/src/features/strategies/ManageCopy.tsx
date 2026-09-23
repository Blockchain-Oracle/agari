import type { StrategySubscription } from "@agari/core/strategies";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { money, parseAmount } from "@/features/strategies/format";
import { Button, Card } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";
import { AmountInput } from "./AmountInput";
import { ReviewGate } from "./ReviewGate";
import type { CopySetup, DeskWrites } from "./useCopySetup";

/**
 * The management half of web's CopyDrawer.tsx: an unfinished setup's progress and release, pause future copies,
 * move Vault funds into the budget, and withdraw. Each is its own reviewed transaction.
 */
export function ManageCopy({ setup, writes, sub, strategyId, availableBase, decimals, symbol }: {
  setup: CopySetup;
  writes: DeskWrites;
  sub: StrategySubscription | null;
  strategyId: string;
  availableBase: bigint;
  decimals: number;
  symbol: string;
}) {
  const { color } = useTheme();
  const [fundAmount, setFundAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const cash = (base: bigint) => money(base, decimals, symbol);
  const { ownGrant, pending, disabled, perform, state } = setup;
  const fundBase = parseAmount(fundAmount, decimals);
  const withdrawBase = parseAmount(withdrawAmount, decimals);
  const withdrawable = availableBase + (ownGrant?.budgetBase ?? 0n);
  const busy = Boolean(writes.busy);

  return (
    <View style={styles.wrap}>
      {pending ? (
        <Card tone="accent">
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
            {writes.busy ? "Copy setup in progress." : pending.stage === "subscribe-ready" ? "Permission saved. Subscription remains." : "An interrupted step needs checking."}
          </Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {writes.busy ? "Waiting for wallet and chain confirmations. Your progress is saved." : "We will check this setup before continuing. The deposit will not be repeated."}
          </Text>
          {pending.grantTx ? <TxLink label="Permission transaction" hash={pending.grantTx} /> : null}
          {pending.subscribeTx ? <TxLink label="Subscription transaction" hash={pending.subscribeTx} /> : null}
          <ReviewGate
            cta={pending.releasePending ? "Check permission release" : "Release this permission"}
            variant="secondary"
            title={`Release the unfinished copy of #${pending.strategyId}`}
            lines={[{ label: "Returns", value: `${cash(BigInt(pending.budgetBase))} to your Trading Balance` }]}
            maxLoss={null}
            confirmLabel="Slide to release"
            busy={writes.busy === "pause"}
            disabled={busy}
            onConfirm={() => perform(writes.releasePending)}
          />
        </Card>
      ) : null}

      {sub?.active ? (
        <ReviewGate
          cta={sub.fade ? "Pause this fade" : "Pause future copies"}
          variant="destructive"
          title={`Pause strategy #${strategyId}`}
          lines={[
            { label: "Budget returned", value: ownGrant ? cash(ownGrant.budgetBase) : "—" },
            { label: "Open positions", value: ownGrant ? `${ownGrant.openPositions} keep running, still yours` : "—" },
          ]}
          maxLoss={null}
          confirmLabel="Slide to pause"
          busy={writes.busy === "pause"}
          disabled={disabled || Boolean(pending)}
          tone="loss"
          onConfirm={() => perform(() => writes.pause(BigInt(strategyId), sub.grantId, sub.fade))}
        />
      ) : null}

      {ownGrant && (state === "copying" || state === "unfunded") ? (
        <Card>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Add budget without changing limits</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            Move up to {cash(availableBase)} of available Vault funds into this permission. One transaction; no subscription fee.
          </Text>
          <AmountInput label="Amount" symbol={symbol} value={fundAmount} onChange={setFundAmount} onMax={() => setFundAmount(money(availableBase, decimals).replace(/,/g, ""))} maxDisabled={availableBase <= 0n} />
          <ReviewGate
            cta="Move Vault funds into budget"
            variant="secondary"
            title="Add to this copy's budget"
            lines={[
              { label: "From Trading Balance", value: cash(fundBase) },
              { label: "New budget", value: cash(ownGrant.budgetBase + fundBase) },
            ]}
            maxLoss={cash(fundBase)}
            confirmLabel="Slide to add"
            busy={writes.busy === "add"}
            disabled={disabled || Boolean(pending)}
            blocker={fundBase <= 0n ? "Enter an amount." : fundBase > availableBase ? "More than your available Vault funds." : null}
            onConfirm={() => perform(() => writes.fundBudget(ownGrant.grantId, fundBase)).then(() => setFundAmount(""))}
          />
        </Card>
      ) : null}

      <Card>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Withdraw available funds</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          Up to {cash(withdrawable)} is available including this copy's unspent budget. Withdrawing from its budget revokes this permission first. Open positions settle separately.
        </Text>
        <AmountInput label="Amount" symbol={symbol} value={withdrawAmount} onChange={setWithdrawAmount} onMax={() => setWithdrawAmount(money(withdrawable, decimals).replace(/,/g, ""))} maxDisabled={withdrawable <= 0n} />
        <ReviewGate
          cta="Withdraw to wallet"
          variant="outline"
          title="Withdraw to your wallet"
          lines={[
            { label: "Amount", value: cash(withdrawBase) },
            { label: "Permission", value: ownGrant ? "revoked first" : "none to revoke", tone: "muted" },
          ]}
          maxLoss={null}
          confirmLabel="Slide to withdraw"
          busy={writes.busy === "withdraw"}
          disabled={disabled || Boolean(pending)}
          blocker={withdrawBase <= 0n ? "Enter an amount." : withdrawBase > withdrawable ? "More than is available." : null}
          onConfirm={() => perform(() => writes.withdraw(ownGrant?.grantId ?? null, withdrawBase)).then(() => setWithdrawAmount(""))}
        />
      </Card>
    </View>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return <Button label={label} variant="ghost" size="sm" block={false} icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(explorerUrl("tx", hash))} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
});
