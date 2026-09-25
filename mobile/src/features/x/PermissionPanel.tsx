import { formatBaseUnits, formatUtc } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X_CARD } from "@/features/x/copy";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import type { XGrantState } from "./useXGrant";

/** web's XPermissionPanel.tsx (`.xt .xw-permission`): the permission's state and its recovery action on the X setup page. */
export function PermissionPanel({ grant, executor, symbol, disabled = false }: {
  grant: XGrantState; executor: string | null; symbol: string; disabled?: boolean;
}) {
  const t = tradeXTokens(useTheme().name);
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
  const updateOff = disabled || !grant.readable || Boolean(grant.busy) || !executor;
  const txHash = pending?.txHash;
  return (
    <View style={[styles.panel, { borderColor: t.xwLine }, needsUpdate && { borderColor: t.v, backgroundColor: t.xwActionBg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: t.muted }]}>{detail}</Text>
      {needsUpdate ? (
        <>
          <Text style={[styles.body, { color: t.muted }]}>{X_CARD.budgetPolicy}</Text>
          <Text style={[styles.note, { color: t.muted }]}>
            {pending ? "No additional deposit. Existing positions stay yours." : "Two wallet confirmations. Reuse your remaining X funds; no additional deposit."}
          </Text>
          <Pressable
            disabled={updateOff}
            onPress={() => void grant.update(executor)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btnV, { borderColor: t.xwBtnBorder }, pressed && { backgroundColor: t.nodeActiveBg }, updateOff && styles.btnVOff]}
          >
            <Text style={[styles.btnVText, { color: t.v }]}>
              {grant.busy === "update" ? "Confirm in your wallet…" : pending ? "Continue X trading update" : state === "expired" ? "Renew X trading" : state === "mismatch" ? "Reconnect X trading" : "Update X trading"}
            </Text>
          </Pressable>
          {pending?.stage === "grant-ready" ? (
            <Pressable disabled={Boolean(grant.busy)} onPress={grant.keepReturnedFunds} accessibilityRole="button" style={({ pressed }) => [styles.btnInk, { borderColor: t.xwLine }, pressed && { backgroundColor: t.xwActionBg }]}>
              <Text style={[styles.btnInkText, { color: t.ink }]}>Keep funds in Trading Balance</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {state === "ready" && grant.grant ? (
        <Text style={[styles.note, { color: t.muted }]}>
          {grant.grant.openPositions}/{grant.grant.caps.maxOpenPositions} open Windows · expires {formatUtc(grant.grant.expiresAtSec * 1000, { withSeconds: false, withDate: true })}
        </Text>
      ) : null}
      {txHash ? (
        <Pressable onPress={() => void openExternal(explorerUrl("tx", txHash))} accessibilityRole="link" style={({ pressed }) => [styles.btnInk, { borderColor: t.xwLine }, pressed && { backgroundColor: t.xwActionBg }]}>
          <Text style={[styles.btnInkText, { color: t.ink }]}>View update transaction ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 12, marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 8 },
  title: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  body: { marginTop: 4, fontFamily: FONT.body, fontSize: 12, lineHeight: 16.5 },
  note: { marginTop: 8, fontFamily: FONT.body, fontSize: 11, lineHeight: 15.125 },
  btnV: { alignSelf: "flex-start", marginTop: 10, borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  btnVOff: { opacity: 0.6 },
  btnVText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20 },
  btnInk: { alignSelf: "flex-start", marginTop: 10, borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  btnInkText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 18 },
});
