import type { RunnerHealth, StrategySubscription } from "@agari/core/strategies";
import { txUrl } from "@agari/core/urls";
import type { VaultGrant } from "@agari/core/vault";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGY_DIRECTION } from "@/features/strategies/copy";
import { COPY_FORM } from "@/features/strategies/copy-form-copy";
import { money, parseAmount } from "@/features/strategies/format";
import { COPY_STATE_LABEL } from "@/features/strategies/lifecycle";
import type { StrategyWire } from "@/features/strategies/protocol";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { CopyFormFields } from "./CopyFormFields";
import { StrategyActivity } from "./StrategyActivity";
import { ConnectButton, DeskPill, Details, ST, StratInput, useStrat } from "./ui";
import type { CopySetup, DeskWrites } from "./useCopySetup";

const RULE: Record<string, string> = {
  copying: "Your permission is active. A trade still needs a signal and fresh risk checks.",
  checking: "Checking your current vault permission and registry consent before making changes.",
  inactive: "This strategy is not accepting new subscriptions. Existing consent can be paused.",
};
const RULE_DEFAULT = "Review a new permission to start or resume. Publishing alone does not fund or activate a copy.";

/** A tx link line in the copy-progress box. */
function TxLink({ label, hash }: { label: string; hash: string }) {
  const { color } = useStrat();
  return (
    <Pressable accessibilityRole="link" onPress={() => void openExternal(txUrl(hash as Parameters<typeof txUrl>[0]))}>
      <Text style={[styles.progressP, styles.mt8, { color: color.ink, textDecorationLine: "underline" }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The copy tab of web's CopyDrawer.tsx: the consent rule, the runner's report, the last result, an unfinished setup,
 * then — connected — how you are copied, the form, pause, move Vault funds and withdraw. Every button calls web's
 * useDeskWrites; the wallet prompt is the confirmation.
 */
export function CopyPanel({ card, sub, grant, setup, writes, availableBase, decimals, symbol, nowMs, health }: {
  card: StrategyWire; sub: StrategySubscription | null; grant: VaultGrant | null; setup: CopySetup; writes: DeskWrites;
  availableBase: bigint; decimals: number; symbol: string; nowMs: number; health: RunnerHealth | null;
}) {
  const { t, color } = useStrat();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const s = setup;
  const { state, pending, ownGrant, disabled, result } = s;
  const withdrawBase = parseAmount(withdrawAmount, decimals);
  const fundBase = parseAmount(fundAmount, decimals);
  const withdrawable = availableBase + (ownGrant?.budgetBase ?? 0n);
  const cash = (base: bigint) => money(base, decimals, symbol);
  const body = [ST.drawerBody, { color: t.ink(0.7) }];
  const box = [styles.progress, { borderColor: t.vermilion }];
  const errorBox = [styles.errorBox, { borderLeftColor: t.vermilion }];
  const summary = [ST.meta, { color: color.ink }];
  const confirmLabel = writes.busy === "join" ? "Checking wallet steps…" : pending ? "Check and finish subscription" : state === "copying" ? "Update budget and limits" : sub ? "Resume with these limits" : s.fade ? "Fund permission and fade" : "Fund permission and copy";
  const caps = s.caps;

  return (
    <View>
      <View style={[styles.rule, { borderLeftColor: t.vermilion }]}>
        {state === "copying" ? (
          <View style={[styles.you, { borderColor: t.profitBorder, backgroundColor: color.profitWash }]}>
            <View style={[styles.youDot, { backgroundColor: color.profit }]} />
            <Text style={[styles.youText, { color: color.profit }]}>{sub?.fade ? COPY_FORM.fading : COPY_FORM.copying}</Text>
          </View>
        ) : null}
        <Text style={[ST.meta, styles.mb8, { color: color.accent }]}>{COPY_STATE_LABEL[state]}</Text>
        <Text style={body}>{RULE[state] ?? RULE_DEFAULT}</Text>
      </View>
      {state === "replaced" && grant && !grant.revoked && sub && grant.grantId !== sub.grantId ? (
        <Text style={[errorBox, styles.errorText, styles.mb12, { color: color.ink }]}>{COPY_FORM.replaced}</Text>
      ) : null}
      <StrategyActivity state={state} grant={grant && sub?.grantId === grant.grantId ? grant : null} health={health} nowMs={nowMs} />
      {result ? (
        <View accessibilityLiveRegion="polite" style={[result.ok ? box : errorBox, styles.mt15]}>
          <Text style={[result.ok ? styles.progressP : styles.errorText, { color: color.ink }]}>{result.ok ? "Confirmed. Your balances and permissions are refreshing." : result.reason}</Text>
          {result.txHash ? <TxLink label="View transaction ↗" hash={result.txHash} /> : null}
        </View>
      ) : null}
      {pending ? (
        <View style={[box, styles.mt15]}>
          <Text style={[styles.progressStrong, { color: color.ink }]}>
            {writes.busy ? "Copy setup in progress." : pending.stage === "subscribe-ready" ? "Permission saved. Subscription remains." : "An interrupted step needs checking."}
          </Text>
          <Text style={[styles.progressP, { color: color.ink }]}>
            {writes.busy ? "Waiting for wallet and chain confirmations. Your progress is saved." : "We will check this setup before continuing. The deposit will not be repeated."}
          </Text>
          {pending.grantTx ? <TxLink label="Permission transaction ↗" hash={pending.grantTx} /> : null}
          {pending.subscribeTx ? <TxLink label="Subscription transaction ↗" hash={pending.subscribeTx} /> : null}
          <DeskPill label={pending.releasePending ? "Check permission release" : "Release this permission"} disabled={disabled} onPress={() => void s.perform(writes.releasePending)} style={styles.mt12} />
        </View>
      ) : null}
      {!writes.address ? (
        <ConnectButton />
      ) : (
        <View>
          {s.anotherPending ? <Text style={[errorBox, styles.errorText, styles.mb16, { color: color.ink }]}>Finish or release strategy #{writes.pending?.strategyId} from Your strategies first.</Text> : null}
          {card.active ? (
            <View style={styles.stack}>
              <View>
                <Text style={[ST.fieldLabel, styles.mb8, { color: color.inkMuted }]}>{STRATEGY_DIRECTION.label}</Text>
                <View style={styles.direction} accessibilityRole="radiogroup" accessibilityLabel={STRATEGY_DIRECTION.label}>
                  {[false, true].map((option) => {
                    const on = s.fade === option;
                    const off = disabled || s.directionLocked;
                    const tone = on ? (option ? { borderColor: color.loss, backgroundColor: color.lossWash } : { borderColor: t.vermilionA(0.6), backgroundColor: t.vermilionA(0.1) }) : { borderColor: t.directionBorder };
                    return (
                      <Pressable key={option ? "fade" : "copy"} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: off }} disabled={off} onPress={() => s.setFade(option)} style={[styles.pill, tone, off && styles.faded]}>
                        <Text style={[ST.mono11, styles.pillText, { color: on ? (option ? color.loss : t.vermilion) : t.directionInk }]}>{option ? STRATEGY_DIRECTION.fade : STRATEGY_DIRECTION.copy}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[body, styles.mt8]}>
                  {s.directionLocked ? (s.fade ? STRATEGY_DIRECTION.lockedFade : STRATEGY_DIRECTION.lockedCopy) : s.fade ? STRATEGY_DIRECTION.fadeNote : STRATEGY_DIRECTION.copyNote}
                </Text>
              </View>
              <CopyFormFields
                check={s.check}
                budget={s.budget}
                perTrade={s.perTrade}
                setBudget={s.setBudget}
                setPerTrade={s.setPerTrade}
                fixed={pending ? { budget: money(s.targetBase, decimals), perTrade: money(s.ceilingBase, decimals) } : null}
                fieldsDisabled={Boolean(pending) || disabled}
                decimals={decimals}
                symbol={symbol}
                walletBase={s.walletBase}
                vaultAvailableBase={availableBase}
                feeBase={s.currentFee.fee}
                confirmBusy={writes.busy === "join"}
                onConfirm={() => void s.join()}
                confirmLabel={confirmLabel}
              >
                <Text style={body}>Strategy maximum: {cash(s.envelope.maxStakePerTradeBase)} per trade. Your limit must fit within your budget. This permission lasts 30 days.</Text>
                {s.valid ? (
                  <Text style={body}>
                    Your permission: {cash(caps.maxStakePerTradeBase)} per trade, {cash(caps.maxDailySpendBase)} per day, {caps.maxOpenPositions} open position{caps.maxOpenPositions === 1 ? "" : "s"}, {caps.maxPriceRaw === 0n ? "without an entry-price ceiling" : `with a maximum entry price of ${cash(caps.maxPriceRaw)} per share`}.
                  </Text>
                ) : null}
                <View style={box}>
                  <Text style={[styles.progressStrong, { color: color.ink }]}>Subscription fee: {s.currentFee.fee === null ? "checking…" : cash(s.currentFee.fee)}</Text>
                  <Text style={[styles.progressP, { color: color.ink }]}>This fee is charged each time you subscribe, including a resume or a change to your limits. The vault budget is separate.</Text>
                  {s.currentFee.error ? <Text accessibilityRole="alert" style={[styles.progressP, { color: color.ink }]}>{s.currentFee.error}</Text> : null}
                  <DeskPill label="Refresh fee" disabled={Boolean(writes.busy)} onPress={s.currentFee.refresh} style={styles.mt8} />
                </View>
                {grant && !grant.revoked && (!sub || sub.grantId !== grant.grantId) ? (
                  <Text style={[errorBox, styles.errorText, { color: color.ink }]}>This replaces your current strategy permission and stops its future copies. Its unspent budget becomes available for this setup.</Text>
                ) : null}
                <Text style={body}>The wallet requests permission first, then subscription consent. Token approval may add a wallet prompt. Losses are possible within your limits.</Text>
              </CopyFormFields>
            </View>
          ) : null}
          {sub?.active ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled || Boolean(pending)}
              onPress={() => void s.perform(() => writes.pause(BigInt(card.strategyId), sub.grantId, sub.fade))}
              style={[styles.pause, { borderColor: t.ink(0.12) }, (disabled || Boolean(pending)) && { opacity: 0.5 }]}
            >
              <Text style={[styles.pauseText, { color: t.gray200 }]}>{sub.fade ? "Pause this fade" : "Pause future copies"}</Text>
            </Pressable>
          ) : null}
          {ownGrant && (state === "copying" || state === "unfunded") ? (
            <Details style={styles.mt20} summaryStyle={summary} summary="Add budget without changing limits">
              <Text style={[body, styles.my12]}>
                Move up to {cash(availableBase)} of available Vault funds into this permission. One transaction; no subscription fee. Deposit more in your{" "}
                <Text style={{ color: color.accent }} onPress={() => router.push("/portfolio" as Href)}>
                  Trading Balance
                </Text>{" "}
                first if needed.
              </Text>
              <Text style={[ST.fieldLabel, { color: color.inkMuted }]}>Amount · {symbol}</Text>
              <StratInput keyboardType="decimal-pad" value={fundAmount} onChangeText={setFundAmount} style={styles.mt2} />
              <DeskPill label="Move Vault funds into budget" disabled={disabled || Boolean(pending) || fundBase <= 0n || fundBase > availableBase} onPress={() => void s.perform(() => writes.fundBudget(ownGrant.grantId, fundBase))} style={styles.mt12} />
            </Details>
          ) : null}
          <Details style={styles.mt20} summaryStyle={summary} summary="Withdraw available funds">
            <Text style={[body, styles.my12]}>
              Up to {cash(withdrawable)} is available including this copy's unspent budget. Withdrawing from its budget revokes this permission first. Open positions settle separately.
            </Text>
            <Text style={[ST.fieldLabel, { color: color.inkMuted }]}>Amount · {symbol}</Text>
            <StratInput keyboardType="decimal-pad" value={withdrawAmount} onChangeText={setWithdrawAmount} style={styles.mt2} />
            <DeskPill label="Withdraw to wallet" disabled={disabled || Boolean(pending) || withdrawBase <= 0n || withdrawBase > withdrawable} onPress={() => void s.perform(() => writes.withdraw(ownGrant?.grantId ?? null, withdrawBase))} style={styles.mt12} />
          </Details>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { borderLeftWidth: 2, paddingLeft: 16, marginTop: 20, marginBottom: 20 },
  you: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 8, marginBottom: 8, paddingVertical: 6, paddingLeft: 10, paddingRight: 12, borderRadius: 9999, borderWidth: 1 },
  youDot: { width: 8, height: 8, borderRadius: 9999 },
  youText: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt15: { marginTop: 15 },
  mt20: { marginTop: 20 },
  my12: { marginVertical: 12 },
  progress: { borderWidth: 1, padding: 15 },
  progressStrong: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  progressP: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  errorBox: { borderLeftWidth: 2, paddingVertical: 11.25, paddingHorizontal: 15 },
  errorText: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  stack: { gap: 16 },
  direction: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, borderRadius: 9999, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  pillText: { textTransform: "uppercase", letterSpacing: 1.32 },
  faded: { opacity: 0.45 },
  pause: { marginTop: 20, borderRadius: 9999, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  pauseText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22.4 },
});
