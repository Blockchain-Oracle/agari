import { formatBaseUnits, formatUtc } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { X_CARD } from "@/features/x/copy";
import { Button } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { ReviewGate } from "../strategies/ReviewGate";
import type { XGrantState } from "./useXGrant";

/** web's features/x/XPermissionPanel.tsx: the X permission's state and, when it needs it, the reviewed update. */
export function PermissionPanel({ grant, executor, symbol, disabled = false }: { grant: XGrantState; executor: string | null; symbol: string; disabled?: boolean }) {
  const { color } = useTheme();
  const state = grant.permission(executor);
  const needsUpdate = ["update", "expired", "mismatch"].includes(state);
  const pending = grant.pendingUpdate;
  const title = pending ? "Finish updating X trading" : state === "ready" ? "X trading enabled"
    : state === "update" ? "Update X trading to use your balance"
    : state === "expired" ? "Renew X trading"
    : state === "mismatch" ? "Reconnect X trading"
    : state === "checking" ? "Checking X trading…"
    : state === "unavailable" ? "X trading status unavailable" : "Fund your X trading balance";
  const detail = pending?.stage === "grant-ready"
    ? `${formatBaseUnits(BigInt(pending.returnedBase ?? "0"), grant.decimals)} ${symbol} returned to your Trading Balance. Continue to use it for X trading.`
    : pending ? "Your progress is saved. Continue to verify the last transaction before any further wallet action."
    : state === "update" ? "Your existing permission still has the old spending limits. Update it to trade from your full X balance."
    : state === "expired" ? "Your permission expired. Your remaining X funds are still here."
    : state === "mismatch" ? "Your permission names a previous executor. Reconnect it to the current X service."
    : state === "unavailable" ? "We could not verify your balance and trading permission. Try again shortly."
    : state === "checking" ? "Reading your balance and permission."
    : X_CARD.budgetPolicy;
  const cta = pending ? "Continue X trading update" : state === "expired" ? "Renew X trading" : state === "mismatch" ? "Reconnect X trading" : "Update X trading";
  return (
    <View style={[styles.panel, { borderColor: needsUpdate ? color.accentDim : color.hairline }]} accessibilityLiveRegion="polite">
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{detail}</Text>
      {needsUpdate ? (
        <>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{X_CARD.budgetPolicy}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {pending ? "No additional deposit. Existing positions stay yours." : "Two wallet confirmations. Reuse your remaining X funds; no additional deposit."}
          </Text>
          <ReviewGate
            cta={grant.busy === "update" ? "Confirm in your wallet…" : cta}
            title={cta}
            lines={[
              { label: "Step 1", value: "pause the old permission" },
              { label: "Step 2", value: "grant it again, same funds" },
              { label: "New deposit", value: `0 ${symbol}`, tone: "muted" },
            ]}
            maxLoss={grant.balanceBase === null ? "—" : `${formatBaseUnits(grant.balanceBase, grant.decimals)} ${symbol}`}
            confirmLabel="Slide to update"
            busy={grant.busy === "update"}
            disabled={disabled || !grant.readable || Boolean(grant.busy) || !executor}
            onConfirm={() => grant.update(executor)}
          />
          {pending?.stage === "grant-ready" ? <Button label="Keep funds in Trading Balance" variant="secondary" size="sm" disabled={Boolean(grant.busy)} onPress={grant.keepReturnedFunds} /> : null}
        </>
      ) : null}
      {state === "ready" && grant.grant ? (
        <Text style={[TYPE.data, { color: color.inkMuted }]}>
          {grant.grant.openPositions}/{grant.grant.caps.maxOpenPositions} open Windows · expires {formatUtc(grant.grant.expiresAtSec * 1000, { withSeconds: false, withDate: true })}
        </Text>
      ) : null}
      {pending?.txHash ? <Button label="View update transaction" variant="ghost" size="sm" block={false} onPress={() => void openExternal(explorerUrl("tx", pending.txHash!))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, gap: 8 },
});
