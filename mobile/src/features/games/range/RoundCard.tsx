import { SETTLING } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import type { RangeRoundStatus } from "@agari/core/range";
import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { Target, Trophy } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { formatMultiplierTenths, usd2, usdBand } from "@/features/range/format";
import type { RangeRoundView } from "@/features/range/useRangeRounds";
import type { RangeBusyKey } from "@/features/range/useRangeWrites";
import { Press } from "~/features/games/frame";
import { FONT } from "~/theme";
import { useRangeTokens } from "./PageParts";
import { Spinner } from "./TicketParts";

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

/** `.pl-pill`: in play, won / paid in the accent, lost / voided quiet. */
function StatusPill({ status }: { status: RangeRoundStatus }) {
  const { r, color } = useRangeTokens();
  const { slip } = RANGE;
  const won = status === "won" || status === "claimed";
  const dead = status === "lost" || status === "void";
  const label = status === "won" ? slip.won : status === "claimed" ? slip.paid : status === "lost" ? slip.lost : status === "void" ? slip.voided : slip.inPlay;
  return (
    <View style={[styles.pill, { backgroundColor: won ? r.pillWonBg : r.pillBg }]}>
      <Text style={[styles.pillText, { color: won ? color.accent : dead ? color.inkMuted : r.gray300 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/**
 * web's `range/RangeCard.tsx`, in the parlay card's grammar: the Window, its pill, the multiple, the band (or a
 * Moonshot's one edge), the opening and closing prints, then the crank, the claim or the verdict. Each write asks
 * the wallet to sign on the tap, as web's does.
 */
export function RoundCard({ round, nowMs, symbol, decimals, staleAfterSec, busy, onClaim, onSettle, onVoidStale }: Props) {
  const { t, r, color } = useRangeTokens();
  const { slip } = RANGE;
  const { status, kind } = round;
  const dead = status === "lost" || status === "void";
  const left = nowMs > 0 ? remainingSec(nowMs, round.expirySec) : null;
  const expired = left === 0;
  const stale = nowMs > 0 && Math.floor(nowMs / 1000) >= round.expirySec + staleAfterSec;
  const settling = busy === `settle:${round.roundId}`;
  const voiding = busy === `void:${round.roundId}`;
  const claiming = busy === `claim:${round.roundId}`;
  const payout = formatBaseUnits(round.maxPayoutBase, decimals);
  const inside = round.closingPrint !== null && round.closingPrint >= round.lowPrint && round.closingPrint <= round.highPrint;
  // A Moonshot is one edge, not two: "above $K" for a long, "below $K" for a short.
  const what = kind.kind === "moonshot" ? slip.target(kind.direction, usdBand(kind.strikePrint)) : slip.band(usdBand(round.lowPrint), usdBand(round.highPrint), round.side);
  const closedLine = round.closingPrint === null ? null : kind.kind === "moonshot" ? slip.closedTarget(usd2(round.closingPrint), inside) : slip.closed(usd2(round.closingPrint), inside);
  const ground = status === "won" ? { borderColor: r.cardWonBorder, backgroundColor: r.cardWonBg } : dead ? { borderColor: r.cardLostBorder, backgroundColor: r.cardLostBg, opacity: 0.6 } : { borderColor: t.cardBorder, backgroundColor: t.cardBg };
  const stateInk = status === "won" || status === "claimed" ? color.accent : status === "live" ? color.inkSecondary : color.inkMuted;

  const crank = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} disabled={settling || voiding} accessibilityRole="button" style={[styles.settle, { borderColor: r.settleBorder }, (settling || voiding) && styles.off]}>
      <Text style={[styles.settleText, { color: color.accent }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.card, ground]}>
      <View style={styles.head}>
        <View style={styles.name}>
          <Target size={14} color={color.accent} strokeWidth={2} />
          <Text style={[styles.streak, { color: color.ink }]}>{slip.round(round.asset ?? "…", round.intervalSec !== null ? formatCadence(round.intervalSec) : "")}</Text>
          <StatusPill status={status} />
        </View>
        <View style={styles.right}>
          <Text style={[styles.x, { color: color.accent }]}>{formatMultiplierTenths(Number((round.maxPayoutBase * 1000n) / (round.stakeBase || 1n)))}</Text>
          <Text style={[styles.sub, { color: color.inkMuted }]}>
            {formatBaseUnits(round.stakeBase, decimals)} → {payout}
          </Text>
        </View>
      </View>

      <View style={styles.legs}>
        <View style={styles.leg}>
          <View style={styles.legMain}>
            <Text style={[styles.legName, { color: color.ink }]}>
              <Text style={[styles.side, { color: color.accent }]}>{what.toUpperCase()}</Text>
              <Text style={{ color: color.inkMuted }}> · {slip.opening(usd2(round.openingPrint))}</Text>
            </Text>
            {closedLine ? <Text style={[styles.close, { color: color.inkMuted }]}>{closedLine}</Text> : null}
          </View>
          <View style={styles.state}>
            {status === "live" ? (
              expired || round.settledOnchain ? (
                <>
                  {crank(settling ? slip.settling : slip.settle, () => onSettle(round))}
                  {stale ? crank(voiding ? slip.voiding : slip.voidStale, () => onVoidStale(round)) : null}
                </>
              ) : (
                <Text style={[styles.stateText, { color: stateInk }]}>{left === null ? "–:––" : left === 0 ? SETTLING : formatClock(left)}</Text>
              )
            ) : (
              <Text style={[styles.stateText, { color: stateInk }]}>{status === "won" ? slip.won : status === "lost" ? slip.lost : status === "void" ? slip.voided : slip.paid}</Text>
            )}
          </View>
        </View>
      </View>

      {status === "won" ? (
        <Press onPress={() => onClaim(round)} disabled={claiming} accessibilityRole="button" style={[styles.claim, { backgroundColor: color.accent }, claiming && styles.off]}>
          {claiming ? <Spinner size={15} color={r.placeInk} /> : <Trophy size={15} color={r.placeInk} />}
          <Text style={[styles.claimText, { color: r.placeInk }]}>{claiming ? slip.claiming : slip.claim(payout, symbol)}</Text>
        </Press>
      ) : null}
      {status === "lost" ? <Text style={[styles.note, { color: color.inkMuted }]}>{slip.lostNote}</Text> : null}
      {status === "void" ? <Text style={[styles.note, { color: color.inkMuted }]}>{slip.voidedNote}</Text> : null}
      {status === "claimed" ? <Text style={[styles.note, { color: color.inkMuted }]}>{slip.paidNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 20 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  name: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, flexShrink: 1 },
  streak: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 20 },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999 },
  pillText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.45 },
  right: { alignItems: "flex-end" },
  x: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 18, fontVariant: ["tabular-nums"] },
  sub: { marginTop: 2, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  legs: { marginBottom: 4 },
  leg: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  legMain: { flex: 1, minWidth: 0 },
  legName: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 16.25 },
  side: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 0.88 },
  close: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  state: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  stateText: { fontFamily: FONT.dataRegular, fontSize: 11, fontVariant: ["tabular-nums"] },
  settle: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1 },
  settleText: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 0.45 },
  off: { opacity: 0.6 },
  claim: { width: "100%", marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12 },
  claimText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 20 },
  note: { marginTop: 12, fontFamily: FONT.body, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
