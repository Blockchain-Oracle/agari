import { SETTLING } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import { nextParlayLegIdx, type ParlayLegStatus, type ParlayStatus } from "@agari/core/parlay";
import { formatBaseUnits, formatClock, remainingSec } from "@agari/core/units";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { formatLineShort, formatMultiplierTenths } from "@/features/parlay/format";
import type { ParlayBusyKey } from "@/features/parlay/useParlayWrites";
import type { ParlayLegView, ParlayTicketView } from "@/features/parlay/useParlayTickets";
import { Button, Pill } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

const S = PARLAY.slip;

const DOT: Record<ParlayLegStatus, SymbolViewProps["name"]> = {
  won: { ios: "checkmark", android: "check" },
  lost: { ios: "xmark", android: "close" },
  void: { ios: "minus", android: "remove" },
  pending: { ios: "clock", android: "schedule" },
};

interface ParlayCardProps {
  ticket: ParlayTicketView;
  nowMs: number;
  symbol: string;
  decimals: number;
  busy: ParlayBusyKey | null;
  onClaim: (ticket: ParlayTicketView) => void;
  onSettle: (ticket: ParlayTicketView, legIdx: number) => void;
}

/**
 * web's `features/parlay/ParlayCard.tsx`: the streak, its state pill, the multiplier, each leg ticking as its Window
 * settles (only the next leg in closing order is offered for settling), then the claim or the verdict.
 */
export function ParlayCard({ ticket, nowMs, symbol, decimals, busy, onClaim, onSettle }: ParlayCardProps) {
  const { color } = useTheme();
  const { status } = ticket;
  const payout = formatBaseUnits(ticket.maxPayoutBase, decimals);
  const nextLeg = status === "live" ? nextParlayLegIdx(ticket.legs) : null;
  const claiming = busy === `claim:${ticket.parlayId}`;
  const border = status === "won" ? color.profit : color.hairline;
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: border, opacity: status === "lost" || status === "void" ? 0.8 : 1 }]}>
      <View style={styles.head}>
        <View style={styles.name}>
          <SymbolView name={{ ios: "square.stack.3d.up", android: "stacks" }} size={14} tintColor={color.inkSecondary} />
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{S.streak(ticket.legs.length)}</Text>
          <StatusPill status={status} wonCount={ticket.wonCount} total={ticket.legs.length} />
        </View>
        <View style={styles.right}>
          <Text style={[TYPE.dataLg, { color: color.accent }]}>{formatMultiplierTenths(Number((ticket.maxPayoutBase * 1000n) / (ticket.stakeBase || 1n)))}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {formatBaseUnits(ticket.stakeBase, decimals)} → {payout}
          </Text>
        </View>
      </View>

      <View style={styles.legs}>
        {ticket.legs.map((leg, i) => (
          <LegLine key={i} leg={leg} idx={i} nowMs={nowMs} busyHere={busy === `settle:${ticket.parlayId}:${i}`} isNext={i === nextLeg} onSettle={() => onSettle(ticket, i)} />
        ))}
      </View>

      {status === "won" ? (
        <Button label={claiming ? S.claiming : S.claim(payout, symbol)} variant="profit" icon={{ ios: "trophy.fill", android: "emoji_events" }} loading={claiming} onPress={() => onClaim(ticket)} />
      ) : null}
      {status === "lost" ? <Text style={[TYPE.caption, { color: color.loss }]}>{S.lost}</Text> : null}
      {status === "void" ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{S.voidedNote}</Text> : null}
      {status === "claimed" ? <Text style={[TYPE.caption, { color: color.profit }]}>{S.paidNote}</Text> : null}
    </View>
  );
}

function LegLine({ leg, idx, nowMs, busyHere, isNext, onSettle }: { leg: ParlayLegView; idx: number; nowMs: number; busyHere: boolean; isNext: boolean; onSettle: () => void }) {
  const { color } = useTheme();
  const left = nowMs > 0 ? remainingSec(nowMs, leg.expirySec) : null;
  const ink = { won: color.profit, lost: color.loss, void: color.inkMuted, pending: color.inkSecondary }[leg.status];
  const word = { won: S.legWon, lost: S.legMissed, void: S.legVoid, pending: null }[leg.status];
  return (
    <View style={styles.leg}>
      <Text style={[TYPE.data, { color: color.inkMuted }]}>{String(idx + 1).padStart(2, "0")}</Text>
      <View style={[styles.dot, { borderColor: ink }]}>
        <SymbolView name={DOT[leg.status]} size={11} tintColor={ink} />
      </View>
      <Text style={[TYPE.caption, styles.legName, { color: color.ink }]} numberOfLines={1}>
        {leg.asset ?? "…"} {leg.intervalSec !== null ? formatCadence(leg.intervalSec) : ""}{" "}
        <Text style={{ color: leg.side === "up" ? color.profit : color.loss }}>{leg.side === "up" ? "UP" : "DOWN"}</Text>
        {leg.openingPriceRaw !== null ? <Text style={{ color: color.inkMuted }}> · {formatLineShort(leg.openingPriceRaw, leg.asset ?? "")}</Text> : null}
      </Text>
      {word ? (
        <Text style={[TYPE.data, { color: ink }]}>{word}</Text>
      ) : leg.settledOnchain && isNext ? (
        <Button label={busyHere ? S.settling : S.settle} variant="secondary" size="sm" block={false} loading={busyHere} onPress={onSettle} />
      ) : (
        <Text style={[TYPE.data, { color: color.inkSecondary }]}>{leg.settledOnchain ? SETTLING : left === null ? "–:––" : left === 0 ? SETTLING : formatClock(left)}</Text>
      )}
    </View>
  );
}

function StatusPill({ status, wonCount, total }: { status: ParlayStatus; wonCount: number; total: number }) {
  if (status === "won" || status === "claimed") return <Pill label={status === "won" ? S.won : S.paid} tone="profit" />;
  if (status === "lost" || status === "void") return <Pill label={status === "lost" ? S.dead : S.voided} tone="loss" />;
  return <Pill label={S.inPlay(wonCount, total)} tone="accent" dot />;
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 14, gap: 12 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  name: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 },
  right: { alignItems: "flex-end" },
  legs: { gap: 8 },
  leg: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  legName: { flex: 1 },
});
