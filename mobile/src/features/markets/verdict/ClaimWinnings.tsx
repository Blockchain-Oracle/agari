import { VOID_HEADLINE } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Verdict } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { invalidateAfterWrite, useClaimables, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { itemsFromRows } from "@/features/markets/claims/claim-run";
import { redeemOne } from "@/features/markets/claims/useClaimAll";
import { useRedemption } from "@/features/markets/claims/useRedemption";
import { useVoidWords } from "@/features/markets/claims/void-line";
import { useVenue } from "@/features/markets/useVenue";
import { diagnosisCopy, VERDICT_UI } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, haptic, SignReview, type SignPhase } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { VerdictStamp } from "./VerdictStamp";

/**
 * web's ClaimWinnings, on the Window's own result: a winner sees the profit as the hero, the return, stake → payout
 * and one control that collects it (behind SignReview, one signature per Window); a loser sees "Not this time"; a void
 * takes the loss card's quiet anatomy with its stamp, "Returned" and the reason. Unclaimed, the venue's settler pays
 * the seat a few minutes after settlement, and the card then says "Paid automatically" with that payout's tx.
 */
export function ClaimWinnings({ verdict, marketId, symbol }: { verdict: Verdict; marketId: MarketId; symbol: string }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const submitter = useSubmitter();
  const queryClient = useQueryClient();
  const claimables = useClaimables(address, venueId);
  const [phase, setPhase] = useState<SignPhase | "idle">("idle");
  const [error, setError] = useState<string | null>(null);

  const rows = claimables && isOk(claimables) ? claimables.value.filter((row) => row.marketId === marketId) : [];
  const items = itemsFromRows(rows);
  const isVoid = verdict.outcome === "void";
  const voidWords = useVoidWords(marketId, isVoid, undefined);
  const won = verdict.outcome !== "loss" && verdict.payoutBase > 0n;
  const settledOut = won && claimables !== null && isOk(claimables) && items.length === 0;
  const redemption = useRedemption(address, marketId, settledOut);
  const money = (base: bigint) => formatBaseUnits(base, verdict.decimals);
  const stake = verdict.costBasisBase ?? 0n;
  const profit = verdict.pnlBase > 0n ? verdict.pnlBase : 0n;
  const roi = stake > 0n ? Number((profit * 100n) / stake) : 0;

  if (verdict.outcome === "loss") {
    return (
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{VERDICT_UI.claim.notThisTime}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{VERDICT_UI.claim.lossBody}</Text>
      </View>
    );
  }
  if (verdict.payoutBase === 0n) return null;
  // Nothing is called paid, and nothing offered, until the claimables have answered.
  const known = claimables !== null && isOk(claimables);
  const collected = phase === "done" || (known && items.length === 0);

  const collect = async () => {
    if (!submitter || !address || items.length === 0) return;
    setPhase("signing");
    setError(null);
    let failed: string | null = null;
    for (const item of items) {
      const result = await redeemOne(submitter, item);
      if (result.patch.diagnosis) {
        failed = diagnosisCopy(result.patch.diagnosis.kind).headline;
        break;
      }
      if (result.stop) break;
    }
    await invalidateAfterWrite(queryClient, { wallet: address });
    // A refusal keeps the control, with the reason above it; nothing is called paid that was not.
    if (failed) {
      setError(failed);
      setPhase("idle");
      haptic.error();
      return;
    }
    setPhase("done");
    haptic.success();
  };

  const paidLine = collected ? (
    <View style={styles.paid}>
      <SymbolView name={{ ios: "checkmark.circle.fill", android: "check_circle" }} size={16} tintColor={isVoid ? color.inkSecondary : color.profit} />
      <Text style={[TYPE.bodyStrong, { color: isVoid ? color.ink : color.profit }]}>{redemption?.byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.paid}</Text>
      {redemption ? (
        <Text onPress={() => openExternal(explorerUrl("tx", redemption.txHash))} style={[TYPE.caption, { color: color.accent }]} accessibilityRole="link">
          {VERDICT_UI.claim.paidTx}
        </Text>
      ) : null}
    </View>
  ) : null;

  const claimControl = collected || !known ? null : phase === "idle" ? (
    <>
      <Button label={VERDICT_UI.claim.collect} variant={isVoid ? "secondary" : "profit"} size="lg" disabled={!submitter} onPress={() => setPhase("review")} />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{isVoid ? VERDICT_UI.claim.voidFoot : VERDICT_UI.claim.foot}</Text>
    </>
  ) : (
    <SignReview
      title={`${VERDICT_UI.claim.collect} · ${money(verdict.payoutBase)} ${symbol}`}
      lines={[
        { label: VERDICT_UI.claim.stake, value: `${money(stake)} ${symbol}` },
        { label: isVoid ? VERDICT_UI.claim.returned : VERDICT_UI.claim.payout, value: `${money(verdict.payoutBase)} ${symbol}`, tone: isVoid ? undefined : "profit" },
        { label: "Signatures", value: String(items.length), hint: "one per Window" },
      ]}
      maxLoss={null}
      confirmLabel="Slide to collect"
      phase={phase === "review" ? "review" : phase}
      tone="profit"
      onConfirm={() => void collect()}
    />
  );

  if (isVoid) {
    return (
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <View style={styles.voidHead}>
          <VerdictStamp outcome="void" size="compact" />
          <View>
            <Text style={[TYPE.dataLg, { color: color.ink }]}>
              {money(verdict.payoutBase)} <Text style={[TYPE.data, { color: color.inkMuted }]}>{symbol}</Text>
            </Text>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{VERDICT_UI.claim.returned}</Text>
          </View>
        </View>
        {voidWords ? <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{voidWords.shareWord}</Text> : null}
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{voidWords?.headline ?? VOID_HEADLINE}</Text>
        {voidWords ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{voidWords.reason}</Text> : null}
        <Flow stake={money(stake)} to={money(verdict.payoutBase)} toLabel={VERDICT_UI.claim.returned} />
        {error ? <Text style={[TYPE.caption, { color: color.loss }]}>{error}</Text> : null}
        {paidLine}
        {claimControl}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: color.profitWash, borderColor: color.profit }]}>
      <View style={styles.eyebrow}>
        <SymbolView name={{ ios: "trophy.fill", android: "trophy" }} size={16} tintColor={color.profit} />
        <Text style={[TYPE.labelMicro, { color: color.profit }]}>{!collected ? VERDICT_UI.claim.youWon : redemption?.byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.claimed}</Text>
      </View>
      <View style={styles.hero}>
        <View>
          <Text style={[styles.profit, { color: color.profit }]}>
            +{money(profit)} <Text style={[TYPE.data, { color: color.inkSecondary }]}>{symbol}</Text>
          </Text>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{VERDICT_UI.claim.profit}</Text>
        </View>
        {roi > 0 ? (
          <View style={styles.roi}>
            <Text style={[TYPE.dataLg, { color: color.profit }]}>+{roi}%</Text>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{VERDICT_UI.claim.ret}</Text>
          </View>
        ) : null}
      </View>
      <Flow stake={money(stake)} to={money(verdict.payoutBase)} toLabel={VERDICT_UI.claim.payout} />
      {error ? <Text style={[TYPE.caption, { color: color.loss }]}>{error}</Text> : null}
      {paidLine}
      {claimControl}
    </View>
  );
}

/** "Stake 5.00 → Payout 9.60". */
function Flow({ stake, to, toLabel }: { stake: string; to: string; toLabel: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.flow}>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        {VERDICT_UI.claim.stake} <Text style={[TYPE.data, { color: color.ink }]}>{stake}</Text>
      </Text>
      <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={12} tintColor={color.inkMuted} />
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        {toLabel} <Text style={[TYPE.data, { color: color.ink }]}>{to}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 16, gap: 10 },
  voidHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hero: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  profit: { fontFamily: FONT.dataStrong, fontSize: 34, lineHeight: 38, fontVariant: ["tabular-nums"] },
  roi: { alignItems: "flex-end" },
  flow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  paid: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
});
