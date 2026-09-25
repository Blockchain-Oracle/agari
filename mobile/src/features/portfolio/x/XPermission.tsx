import { formatBaseUnits, formatUtc } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X_CARD } from "@/features/x/copy";
import type { XGrantState } from "@/features/x/useXGrant";
import { openExternal } from "~/lib/external";
import { marketsEnv } from "~/lib/env";
import { useXInk, xs } from "./ink";

/** web `XPermissionPanel`'s title and sentence for the grant's state, word for word. */
function permissionCopy(grant: XGrantState, executor: string | null, symbol: string): { title: string; detail: string } {
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

/** web `XPermissionPanel` (`.xw-permission`, `--action` when the grant needs an update): state, action, recovery. */
export function XPermission({ grant, executor, symbol, disabled }: { grant: XGrantState; executor: string | null; symbol: string; disabled: boolean }) {
  const x = useXInk();
  const state = grant.permission(executor);
  const needsUpdate = ["update", "expired", "mismatch"].includes(state);
  const pending = grant.pendingUpdate;
  const { title, detail } = permissionCopy(grant, executor, symbol);
  const off = disabled || !grant.readable || Boolean(grant.busy) || !executor;
  const action = grant.busy === "update" ? "Confirm in your wallet…" : pending ? "Continue X trading update" : state === "expired" ? "Renew X trading" : state === "mismatch" ? "Reconnect X trading" : "Update X trading";
  return (
    <View style={[styles.box, { borderColor: needsUpdate ? x.v : x.line, backgroundColor: needsUpdate ? x.permissionWash : "transparent" }]} accessibilityRole="summary">
      <Text style={[xs.slabTitle, { color: x.ink }]}>{title}</Text>
      <Text style={[xs.slabBody, { color: x.mute }]}>{detail}</Text>
      {needsUpdate ? (
        <>
          <Text style={[xs.slabBody, { color: x.mute }]}>{X_CARD.budgetPolicy}</Text>
          <Text style={[xs.slabNote, { color: x.mute }]}>{pending ? "No additional deposit. Existing positions stay yours." : "Two wallet confirmations. Reuse your remaining X funds; no additional deposit."}</Text>
          <Pressable disabled={off} onPress={() => void grant.update(executor)} accessibilityRole="button" style={[xs.btnV, { borderColor: x.vBorder }, off && xs.disabled]}>
            <Text style={[xs.btnVText, { color: x.v }]}>{action}</Text>
          </Pressable>
          {pending?.stage === "grant-ready" ? (
            <Pressable disabled={Boolean(grant.busy)} onPress={grant.keepReturnedFunds} accessibilityRole="button" style={[xs.btnInk, styles.gap, { borderColor: x.line }]}>
              <Text style={[xs.btnInkText, { color: x.ink }]}>Keep funds in Trading Balance</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {state === "ready" && grant.grant ? (
        <Text style={[xs.slabNote, { color: x.mute }]}>
          {grant.grant.openPositions}/{grant.grant.caps.maxOpenPositions} open Windows · expires {formatUtc(grant.grant.expiresAtSec * 1000, { withSeconds: false, withDate: true })}
        </Text>
      ) : null}
      {pending?.txHash ? (
        <Pressable
          onPress={() => void openExternal(txUrl(pending.txHash as Parameters<typeof txUrl>[0], marketsEnv.cluster))}
          accessibilityRole="link"
          style={[xs.btnInk, styles.gap, { borderColor: x.line }]}
        >
          <Text style={[xs.btnInkText, { color: x.ink }]}>View update transaction ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 8 },
  gap: { marginTop: 10 },
});
