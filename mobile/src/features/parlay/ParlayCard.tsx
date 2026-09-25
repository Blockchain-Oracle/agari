import { SETTLING } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import { nextParlayLegIdx, type ParlayLegStatus, type ParlayStatus } from "@agari/core/parlay";
import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { Check, Clock, Layers, Minus, Trophy, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { formatLineShort, formatMultiplierTenths } from "@/features/parlay/format";
import type { ParlayBusyKey } from "@/features/parlay/useParlayWrites";
import type { ParlayLegView, ParlayTicketView } from "@/features/parlay/useParlayTickets";
import { FONT } from "~/theme";
import { useEarnParlay } from "~/features/earn/EarnKit";
import { Crank } from "~/features/earn/WindowsTable";
import { Rise, Spinner } from "./ParlayKit";

interface ParlayCardProps {
  ticket: ParlayTicketView;
  nowMs: number;
  symbol: string;
  decimals: number;
  busy: ParlayBusyKey | null;
  onClaim: (ticket: ParlayTicketView) => void;
  onSettle: (ticket: ParlayTicketView, legIdx: number) => void;
}

function DotIcon({ status, ink }: { status: ParlayLegStatus; ink: string }) {
  if (status === "won") return <Check size={12} strokeWidth={3} color={ink} />;
  if (status === "lost") return <X size={12} strokeWidth={3} color={ink} />;
  if (status === "void") return <Minus size={12} strokeWidth={3} color={ink} />;
  return <Clock size={11} color={ink} />;
}

function LegLine({ leg, idx, first, nowMs, busyHere, isNext, onSettle }: { leg: ParlayLegView; idx: number; first: boolean; nowMs: number; busyHere: boolean; isNext: boolean; onSettle: () => void }) {
  const { color, t } = useEarnParlay();
  const { slip } = PARLAY;
  const left = nowMs > 0 ? remainingSec(nowMs, leg.expirySec) : null;
  const won = leg.status === "won";
  const dot = won
    ? { borderColor: t.clear, backgroundColor: color.accent }
    : leg.status === "lost"
      ? { borderColor: t.clear, backgroundColor: t.dotLostBg }
      : { borderColor: t.dotBorder, borderStyle: leg.status === "void" ? ("dashed" as const) : ("solid" as const) };
  const stateInk = won ? color.accent : leg.status === "pending" ? color.inkSecondary : color.inkMuted;
  return (
    <View style={[styles.cleg, { borderTopColor: t.clegRule, borderTopWidth: first ? 0 : 1 }]}>
      <Text style={[styles.clegIdx, { color: color.inkDisabled }]}>{String(idx + 1).padStart(2, "0")}</Text>
      <View style={[styles.dot, dot]}>
        <DotIcon status={leg.status} ink={won ? t.white : color.inkMuted} />
      </View>
      <View style={styles.clegMain}>
        <Text style={[styles.clegName, { color: color.ink }]}>
          {leg.asset ?? "…"} {leg.intervalSec !== null && formatCadence(leg.intervalSec)} <Text style={{ color: leg.side === "up" ? color.accent : t.sky }}>{leg.side === "up" ? "UP" : "DOWN"}</Text>
          {leg.openingPriceRaw !== null ? <Text style={{ color: color.inkMuted }}> · {formatLineShort(leg.openingPriceRaw, leg.asset ?? "")}</Text> : null}
        </Text>
      </View>
      <View style={styles.clegState}>
        {leg.status === "pending" && leg.settledOnchain && isNext ? (
          <Crank label={busyHere ? slip.settling : slip.settle} disabled={busyHere} onPress={onSettle} flush />
        ) : (
          <Text style={[styles.clegStateText, { color: stateInk }]}>
            {leg.status === "won" && slip.legWon}
            {leg.status === "lost" && slip.legMissed}
            {leg.status === "void" && slip.legVoid}
            {leg.status === "pending" && (leg.settledOnchain ? SETTLING : left === null ? "–:––" : left === 0 ? SETTLING : formatClock(left))}
          </Text>
        )}
      </View>
    </View>
  );
}

function StatusPill({ status, wonCount, total }: { status: ParlayStatus; wonCount: number; total: number }) {
  const { color, t } = useEarnParlay();
  const { slip } = PARLAY;
  const won = status === "won" || status === "claimed";
  const dead = status === "lost" || status === "void";
  const text = won ? (status === "won" ? slip.won : slip.paid) : dead ? (status === "lost" ? slip.dead : slip.voided) : slip.inPlay(wonCount, total);
  return (
    <View style={[styles.pill, { backgroundColor: won ? t.vermilion15 : t.pillBg }]}>
      <Text style={[styles.pillText, { color: won ? color.accent : dead ? color.inkMuted : t.gray300 }]}>{text}</Text>
    </View>
  );
}

/** web's `features/parlay/ParlayCard.tsx`: the streak, its pill, the multiplier, the legs, then the claim or the verdict. */
export function ParlayCard({ ticket, nowMs, symbol, decimals, busy, onClaim, onSettle }: ParlayCardProps) {
  const { color, t } = useEarnParlay();
  const { slip } = PARLAY;
  const { status } = ticket;
  const lost = status === "lost";
  const claiming = busy === `claim:${ticket.parlayId}`;
  const payout = formatBaseUnits(ticket.maxPayoutBase, decimals);
  // The reserve decides legs in the order their Windows close, so only that one leg is offered for settling.
  const nextLeg = status === "live" ? nextParlayLegIdx(ticket.legs) : null;
  const surface =
    status === "won"
      ? { borderColor: t.vermilion40, backgroundColor: t.vermilion4 }
      : lost || status === "void"
        ? { borderColor: t.lostBorder, backgroundColor: t.lostBg, opacity: 0.6 }
        : { borderColor: t.tableBorder, backgroundColor: t.tableBg };
  return (
    <Rise style={[styles.card, surface]}>
      <View style={styles.head}>
        <View style={styles.name}>
          <Layers size={14} color={color.accent} />
          <Text style={[styles.streak, { color: color.ink }]}>{slip.streak(ticket.legs.length)}</Text>
          <StatusPill status={status} wonCount={ticket.wonCount} total={ticket.legs.length} />
        </View>
        <View style={styles.right}>
          <Text style={[styles.x, { color: color.accent }]}>{formatMultiplierTenths(Number((ticket.maxPayoutBase * 1000n) / (ticket.stakeBase || 1n)))}</Text>
          <Text style={[styles.sub, { color: color.inkMuted }]}>
            {formatBaseUnits(ticket.stakeBase, decimals)} → {payout}
          </Text>
        </View>
      </View>

      <View style={styles.legs}>
        {ticket.legs.map((leg, i) => (
          <LegLine key={i} leg={leg} idx={i} first={i === 0} nowMs={nowMs} busyHere={busy === `settle:${ticket.parlayId}:${i}`} isNext={i === nextLeg} onSettle={() => onSettle(ticket, i)} />
        ))}
      </View>

      {status === "won" ? (
        <Pressable
          onPress={() => onClaim(ticket)}
          disabled={claiming}
          accessibilityRole="button"
          style={({ pressed }) => [styles.claim, { backgroundColor: pressed ? color.accentPressed : color.accent, opacity: claiming ? 0.6 : 1 }]}
        >
          {claiming ? <Spinner size={15} color={color.onAccent} /> : <Trophy size={15} color={color.onAccent} />}
          <Text style={[styles.claimText, { color: color.onAccent }]}>{claiming ? slip.claiming : slip.claim(payout, symbol)}</Text>
        </Pressable>
      ) : null}
      {lost ? <Text style={[styles.note, { color: color.inkMuted }]}>{slip.lost}</Text> : null}
      {status === "void" ? <Text style={[styles.note, { color: color.inkMuted }]}>{slip.voidedNote}</Text> : null}
      {status === "claimed" ? <Text style={[styles.note, { color: color.inkMuted }]}>{slip.paidNote}</Text> : null}
    </Rise>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 20 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  name: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, flexWrap: "wrap" },
  streak: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 21 },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999 },
  pillText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 0.45, textTransform: "uppercase" },
  right: { alignItems: "flex-end" },
  x: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 20, fontVariant: ["tabular-nums"] },
  sub: { marginTop: 2, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  legs: { marginBottom: 4 },
  cleg: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  clegIdx: { width: 16, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  dot: { width: 20, height: 20, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  clegMain: { flex: 1, minWidth: 0 },
  clegName: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 16.25 },
  clegState: { flexDirection: "row", alignItems: "center", gap: 8 },
  clegStateText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5, fontVariant: ["tabular-nums"] },
  claim: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12 },
  claimText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 20 },
  note: { marginTop: 12, textAlign: "center", fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
});
