import { formatBaseUnits, formatUtc } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { StyleSheet, Text, View } from "react-native";
import { X_CARD } from "@/features/x/copy";
import type { XGrantState } from "@/features/x/useXGrant";
import { Button } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { marketsEnv } from "~/lib/env";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { usePlateInk } from "./usePlateInk";

/** web `XPermissionPanel`'s title and sentence for the grant's state, word for word. */
export function permissionCopy(grant: XGrantState, executor: string | null, symbol: string): { title: string; detail: string } {
  const state = grant.permission(executor);
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
  return { title, detail };
}

interface Props {
  grant: XGrantState;
  executor: string | null;
  symbol: string;
  disabled: boolean;
  /** Opens the review for the two-signature update; the grant's own `update` runs after the slide. */
  onUpdate: () => void;
}

/** web `XPermissionPanel`: the permission's state, the update/renew action, and its recovery controls. */
export function XPermission({ grant, executor, symbol, disabled, onUpdate }: Props) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const state = grant.permission(executor);
  const needsUpdate = ["update", "expired", "mismatch"].includes(state);
  const pending = grant.pendingUpdate;
  const { title, detail } = permissionCopy(grant, executor, symbol);
  const action = grant.busy === "update" ? "Confirm in your wallet…" : pending ? "Continue X trading update" : state === "expired" ? "Renew X trading" : state === "mismatch" ? "Reconnect X trading" : "Update X trading";

  return (
    <View style={[styles.box, { borderColor: needsUpdate ? color.accentDim : ink.line }]} accessibilityRole="summary">
      <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{title}</Text>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{detail}</Text>
      {needsUpdate ? (
        <>
          <Text style={[TYPE.caption, { color: ink.mute }]}>{X_CARD.budgetPolicy}</Text>
          <Text style={[TYPE.caption, { color: ink.mute }]}>
            {pending ? "No additional deposit. Existing positions stay yours." : "Two wallet confirmations. Reuse your remaining X funds; no additional deposit."}
          </Text>
          <Button label={action} disabled={disabled || !grant.readable || Boolean(grant.busy) || !executor} onPress={onUpdate} />
          {pending?.stage === "grant-ready" ? (
            <Button label="Keep funds in Trading Balance" variant="outline" disabled={Boolean(grant.busy)} onPress={grant.keepReturnedFunds} />
          ) : null}
        </>
      ) : null}
      {state === "ready" && grant.grant ? (
        <Text style={[TYPE.caption, { color: ink.mute }]}>
          {grant.grant.openPositions}/{grant.grant.caps.maxOpenPositions} open Windows · expires {formatUtc(grant.grant.expiresAtSec * 1000, { withSeconds: false, withDate: true })}
        </Text>
      ) : null}
      {pending?.txHash ? (
        <Button label="View update transaction ↗" variant="ghost" size="sm" block={false} onPress={() => void openExternal(txUrl(pending.txHash as Parameters<typeof txUrl>[0], marketsEnv.cluster))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 6 },
});
