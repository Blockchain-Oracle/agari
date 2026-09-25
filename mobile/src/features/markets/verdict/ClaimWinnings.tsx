import { VOID_HEADLINE } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Verdict } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { invalidateAfterWrite, useClaimables, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { itemsFromRows } from "@/features/markets/claims/claim-run";
import { redeemOne } from "@/features/markets/claims/useClaimAll";
import { useRedemption } from "@/features/markets/claims/useRedemption";
import { useVoidWords } from "@/features/markets/claims/void-line";
import { useVenue } from "@/features/markets/useVenue";
import { diagnosisCopy, VERDICT_UI } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { wordsTokens } from "~/theme/web/markets-words";
import { Collect, Flow, Paid, WinGlow } from "./claim-parts";
import { VerdictStamp } from "./VerdictStamp";

/**
 * web's ClaimWinnings, on the Window's own result: a winner sees the profit as the hero, the return, stake → payout,
 * and one button that collects it (the wallet's approval is the confirmation, as on web); a loser sees "Not this time";
 * a void takes the loss card's quiet anatomy with its stamp, "Returned" and the reason. Unclaimed, the venue's settler
 * pays the seat after the claim grace, and the card says "Paid automatically" with that payout's transaction.
 */
export function ClaimWinnings({ verdict, marketId, symbol }: { verdict: Verdict; marketId: MarketId; symbol: string }) {
  const { name, color } = useTheme();
  const t = wordsTokens(name);
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const submitter = useSubmitter();
  const queryClient = useQueryClient();
  const claimables = useClaimables(address, venueId);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = claimables && isOk(claimables) ? claimables.value.filter((row) => row.marketId === marketId) : [];
  const items = itemsFromRows(rows);
  const isVoid = verdict.outcome === "void";
  const voidWords = useVoidWords(marketId, isVoid, undefined);
  const won = verdict.outcome !== "loss" && verdict.payoutBase > 0n;
  // Only once the claimables have answered with nothing left for this Window is there a payout to trace.
  const settledOut = won && claimables !== null && isOk(claimables) && items.length === 0;
  const redemption = useRedemption(address, marketId, settledOut);
  const money = (base: bigint) => formatBaseUnits(base, verdict.decimals);
  const stake = verdict.costBasisBase ?? 0n;
  const profit = verdict.pnlBase > 0n ? verdict.pnlBase : 0n;
  const roi = stake > 0n ? Number((profit * 100n) / stake) : 0;

  if (verdict.outcome === "loss") {
    return (
      <View style={[styles.loss, { borderColor: t.cwLossBorder, backgroundColor: t.cwLossFill }]}>
        <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{VERDICT_UI.claim.notThisTime}</Text>
        <Text style={[styles.lossBody, { color: color.inkSecondary }]}>{VERDICT_UI.claim.lossBody}</Text>
      </View>
    );
  }
  if (verdict.payoutBase === 0n) return null;
  const collected = claimed || items.length === 0;

  const collect = async () => {
    if (!submitter || !address || items.length === 0) return;
    setClaiming(true);
    setError(null);
    let failed = false;
    for (const item of items) {
      const result = await redeemOne(submitter, item);
      if (result.patch.diagnosis) {
        setError(diagnosisCopy(result.patch.diagnosis.kind).headline);
        failed = true;
        break;
      }
      if (result.stop) break;
    }
    await invalidateAfterWrite(queryClient, { wallet: address });
    setClaiming(false);
    // A refusal keeps the button, with the reason above it: nothing is called paid that was not (web marks it claimed).
    if (failed) {
      haptic.error();
      return;
    }
    setClaimed(true);
    haptic.success();
  };

  const tail = collected ? (
    <Paid tone={isVoid ? "void" : "win"} byCrank={redemption?.byCrank ?? false} txHash={redemption?.txHash ?? null} />
  ) : (
    <Collect tone={isVoid ? "void" : "win"} claiming={claiming} disabled={claiming || !submitter} onPress={() => void collect()} />
  );

  if (isVoid) {
    return (
      <View style={[styles.loss, { borderColor: t.cwLossBorder, backgroundColor: t.cwLossFill }]}>
        <View style={styles.voidHead}>
          <VerdictStamp outcome="void" size="compact" />
          <View style={styles.voidFigure}>
            <Text style={[styles.voidAmount, { color: t.gray200 }]}>
              {money(verdict.payoutBase)}
              <Text style={[styles.voidUnit, { color: color.inkMuted }]}>{`  ${symbol}`}</Text>
            </Text>
            <Text style={[styles.eyebrow, styles.voidReturned, { color: color.inkMuted }]}>{VERDICT_UI.claim.returned}</Text>
          </View>
        </View>
        {voidWords ? <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{voidWords.shareWord}</Text> : null}
        <Text style={[styles.lossBody, { color: color.inkSecondary }]}>{voidWords?.headline ?? VOID_HEADLINE}</Text>
        {voidWords ? <Text style={[styles.reason, { color: color.inkMuted }]}>{voidWords.reason}</Text> : null}
        <Flow stake={money(stake)} to={money(verdict.payoutBase)} toLabel={VERDICT_UI.claim.returned} />
        {error ? <Text style={[styles.error, { color: color.loss }]}>{error}</Text> : null}
        {tail}
      </View>
    );
  }

  return (
    <View style={[styles.win, { borderColor: t.cwWinBorder }]}>
      <WinGlow />
      <View style={styles.eyebrowRow}>
        <Trophy size={16} color={color.profit} />
        <Text style={[styles.winEyebrow, { color: color.profit }]}>
          {!collected ? VERDICT_UI.claim.youWon : redemption?.byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.claimed}
        </Text>
      </View>
      <View style={styles.hero}>
        <View>
          <View style={styles.figure}>
            <Text style={[styles.profit, { color: color.profit }]}>+{money(profit)}</Text>
            <Text style={[styles.unit, { color: t.cwProfit60 }]}>{symbol}</Text>
          </View>
          <Text style={[styles.winLabel, { color: t.cwProfit70 }]}>{VERDICT_UI.claim.profit}</Text>
        </View>
        {roi > 0 ? (
          <View style={[styles.roi, { borderColor: t.cwRoiBorder, backgroundColor: t.cwRoiFill }]}>
            <Text style={[styles.roiValue, { color: color.profit }]}>+{roi}%</Text>
            <Text style={[styles.roiLabel, { color: t.cwProfit60 }]}>{VERDICT_UI.claim.ret}</Text>
          </View>
        ) : null}
      </View>
      <Flow stake={money(stake)} to={money(verdict.payoutBase)} toLabel={VERDICT_UI.claim.payout} />
      {error ? <Text style={[styles.error, { color: color.loss }]}>{error}</Text> : null}
      {tail}
    </View>
  );
}

const styles = StyleSheet.create({
  loss: { borderRadius: 16, borderWidth: 1, padding: 20 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 },
  lossBody: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  voidHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  voidFigure: { alignItems: "flex-end" },
  voidAmount: { fontFamily: FONT.headingHeavy, fontSize: 28, lineHeight: 28, letterSpacing: -0.7, fontVariant: ["tabular-nums"] },
  voidUnit: { fontFamily: FONT.dataRegular, fontSize: 12, letterSpacing: 0 },
  voidReturned: { marginTop: 4, marginBottom: 0 },
  reason: { marginTop: 6, fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
  error: { marginTop: 12, fontFamily: FONT.bodyMedium, fontSize: 12, lineHeight: 18 },
  win: { borderRadius: 16, borderWidth: 1, padding: 20, overflow: "hidden" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  winEyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, textTransform: "uppercase" },
  hero: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  figure: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  profit: { fontFamily: FONT.headingHeavy, fontSize: 44, lineHeight: 44, letterSpacing: -1.1, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 20, paddingBottom: 4 },
  winLabel: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, textTransform: "uppercase" },
  roi: { borderRadius: 8, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center", flexShrink: 0 },
  roiValue: { fontFamily: FONT.dataStrong, fontSize: 18, lineHeight: 18, fontVariant: ["tabular-nums"] },
  roiLabel: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12, letterSpacing: 1.28, textTransform: "uppercase" },
});
