import { SETTLING } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { formatMultiplierTenths, usd2, usdBand } from "@/features/range/format";
import type { RangeRoundView } from "@/features/range/useRangeRounds";
import type { RangeBusyKey } from "@/features/range/useRangeWrites";
import { Button, Card, Pill, SignReview, type QuoteLine } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

type Action = "claim" | "settle" | "void";

interface Props {
  round: RangeRoundView;
  nowMs: number;
  symbol: string;
  decimals: number;
  /** The reserve's grace after expiry before a round the hub never answered may be voided. */
  staleAfterSec: number;
  busy: RangeBusyKey | null;
  onClaim: (round: RangeRoundView) => void;
  onSettle: (round: RangeRoundView) => void;
  onVoidStale: (round: RangeRoundView) => void;
}

/**
 * web's `range/RangeCard.tsx`: one round — the Window, its pill, the multiple, the band (or a Moonshot's one edge),
 * the opening and closing prints, then the crank, the claim or the verdict. Each write opens the kit's SignReview on
 * the card first; nothing is signed from the tap itself.
 */
export function RoundCard({ round, nowMs, symbol, decimals, staleAfterSec, busy, onClaim, onSettle, onVoidStale }: Props) {
  const { color } = useTheme();
  const [review, setReview] = useState<Action | null>(null);
  const { slip } = RANGE;
  const { status, kind } = round;
  const left = nowMs > 0 ? remainingSec(nowMs, round.expirySec) : null;
  const expired = left === 0;
  const stale = nowMs > 0 && Math.floor(nowMs / 1000) >= round.expirySec + staleAfterSec;
  const payout = formatBaseUnits(round.maxPayoutBase, decimals);
  const inside = round.closingPrint !== null && round.closingPrint >= round.lowPrint && round.closingPrint <= round.highPrint;
  // A Moonshot is one edge, not two: "above $K" for a long, "below $K" for a short.
  const what = kind.kind === "moonshot" ? slip.target(kind.direction, usdBand(kind.strikePrint)) : slip.band(usdBand(round.lowPrint), usdBand(round.highPrint), round.side);
  const closedLine =
    round.closingPrint === null ? null : kind.kind === "moonshot" ? slip.closedTarget(usd2(round.closingPrint), inside) : slip.closed(usd2(round.closingPrint), inside);
  const pill =
    status === "won" ? <Pill label={slip.won} tone="profit" /> : status === "claimed" ? <Pill label={slip.paid} tone="profit" /> : status === "lost" ? <Pill label={slip.lost} tone="loss" /> : status === "void" ? <Pill label={slip.voided} /> : <Pill label={slip.inPlay} tone="accent" dot />;
  const multiple = formatMultiplierTenths(Number((round.maxPayoutBase * 1000n) / (round.stakeBase || 1n)));
  const canCrank = status === "live" && (expired || round.settledOnchain);
  const pending = busy === `claim:${round.roundId}` || busy === `settle:${round.roundId}` || busy === `void:${round.roundId}`;

  const reviewLines: QuoteLine[] = [
    { label: "Round", value: `${round.asset ?? "…"} ${round.intervalSec !== null ? formatCadence(round.intervalSec) : ""}` },
    { label: "Call", value: what },
    ...(review === "claim" ? [{ label: "Paid to your wallet", value: `${payout} ${symbol}`, tone: "profit" as const }] : []),
    ...(review === "void" ? [{ label: "Refunded to your wallet", value: `${formatBaseUnits(round.stakeBase, decimals)} ${symbol}` }] : []),
  ];
  const confirm = () => {
    if (review === "claim") onClaim(round);
    else if (review === "settle") onSettle(round);
    else if (review === "void") onVoidStale(round);
    setReview(null);
  };

  return (
    <Card style={status === "won" ? { borderColor: color.profit } : undefined}>
      <View style={styles.head}>
        <View style={styles.name}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{slip.round(round.asset ?? "…", round.intervalSec !== null ? formatCadence(round.intervalSec) : "")}</Text>
          {pill}
        </View>
        <View style={styles.right}>
          <Text style={[TYPE.dataLg, { color: color.accent }]}>{multiple}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {formatBaseUnits(round.stakeBase, decimals)} → {payout}
          </Text>
        </View>
      </View>
      <View style={[styles.leg, { borderTopColor: color.hairline }]}>
        <View style={styles.legMain}>
          <Text style={[TYPE.data, { color: color.ink }]}>{what}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{slip.opening(usd2(round.openingPrint))}</Text>
          {closedLine ? <Text style={[TYPE.caption, { color: inside ? color.profit : color.loss }]}>{closedLine}</Text> : null}
        </View>
        {status === "live" && !canCrank ? <Text style={[TYPE.data, { color: color.inkSecondary }]}>{left === null ? "–:––" : left === 0 ? SETTLING : formatClock(left)}</Text> : null}
      </View>

      {review ? (
        <SignReview
          title={review === "claim" ? slip.claim(payout, symbol) : review === "settle" ? slip.settle : slip.voidStale}
          lines={reviewLines}
          maxLoss={null}
          confirmLabel={review === "claim" ? "Slide to claim" : review === "settle" ? "Slide to settle" : "Slide to void"}
          onConfirm={confirm}
          tone={review === "claim" ? "profit" : "accent"}
        />
      ) : null}
      {review ? <Button label="Not now" variant="ghost" size="sm" onPress={() => setReview(null)} /> : null}

      {!review && canCrank ? (
        <View style={styles.actions}>
          <Button label={pending ? slip.settling : slip.settle} variant="secondary" size="sm" loading={busy === `settle:${round.roundId}`} disabled={pending} onPress={() => setReview("settle")} />
          {stale ? <Button label={pending ? slip.voiding : slip.voidStale} variant="outline" size="sm" loading={busy === `void:${round.roundId}`} disabled={pending} onPress={() => setReview("void")} /> : null}
        </View>
      ) : null}
      {!review && status === "won" ? (
        <Button
          label={busy === `claim:${round.roundId}` ? slip.claiming : slip.claim(payout, symbol)}
          variant="profit"
          icon={{ ios: "trophy.fill", android: "emoji_events" }}
          loading={busy === `claim:${round.roundId}`}
          onPress={() => setReview("claim")}
        />
      ) : null}
      {status === "lost" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{slip.lostNote}</Text> : null}
      {status === "void" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{slip.voidedNote}</Text> : null}
      {status === "claimed" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{slip.paidNote}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { flexShrink: 1, gap: 6 },
  right: { alignItems: "flex-end", gap: 2 },
  leg: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  legMain: { flex: 1, gap: 2 },
  actions: { gap: 8 },
});
