import { formatCadence } from "@agari/core/copy";
import { shortBookTotals, shortPnl, type LeverageMark, type LeveragePosition } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useLeverageMark, useMarket, useMyLeveragePositions } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLeverageWrites } from "@/features/leverage";
import { SHORT } from "@/features/short/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { ConnectGate, EmptyState, LoadingState } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import type { ReviewRequest } from "./ReviewSheet";
import { ShortPositionCard } from "./ShortPositionCard";

/** web's `CLOSE_FLOOR_BPS`: the owner's slippage guard on a close; the book may move between the mark and the send. */
const CLOSE_FLOOR_BPS = 9_700n;
const W = SHORT.positions;

type Writes = ReturnType<typeof useLeverageWrites>;
type Report = (positionId: string, mark: LeverageMark | null) => void;

interface Props {
  symbol: string;
  decimals: number;
  nowMs: number;
  onReview: (request: ReviewRequest) => void;
}

/**
 * web's `features/short/ShortPositions.tsx`: the wallet's shorts, live first, under one totals line computed with
 * the cards' own arithmetic (`shortBookTotals`). Each card reads its own mark and reports it up by value.
 */
export function ShortPositions({ symbol, decimals, nowMs, onReview }: Props) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const reading = useMyLeveragePositions(address);
  const writes = useLeverageWrites();
  const [marks, setMarks] = useState<ReadonlyMap<string, LeverageMark | null>>(() => new Map());

  const report = useCallback<Report>((positionId, mark) => {
    setMarks((prev) => {
      if (sameMark(prev.get(positionId) ?? null, mark)) return prev;
      const next = new Map(prev);
      next.set(positionId, mark);
      return next;
    });
  }, []);

  const held = useMemo(() => (reading && isOk(reading) ? reading.value : []), [reading]);
  const live = useMemo(() => held.filter((p) => p.status === "live"), [held]);
  const done = useMemo(() => held.filter((p) => p.status !== "live"), [held]);
  const totals = useMemo(() => shortBookTotals(live.map((position) => ({ position, mark: marks.get(position.positionId.toString()) ?? null }))), [live, marks]);

  if (address === null) return <ConnectGate why={W.connect} />;
  if (reading === null) return <LoadingState shape="list" />;
  if (held.length === 0) return <EmptyState why={W.empty} detail={W.emptyBody} />;

  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const pnlInk = totals.pnlBase > 0n ? color.profit : totals.pnlBase < 0n ? color.loss : color.inkSecondary;
  const card = (position: LeveragePosition) => (
    <PositionRow key={position.positionId.toString()} position={position} symbol={symbol} decimals={decimals} nowMs={nowMs} writes={writes} report={report} onReview={onReview} />
  );

  return (
    <View style={styles.book}>
      {live.length > 0 ? (
        <View style={[styles.totals, { backgroundColor: color.surface2 }]}>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{W.totals(totals.priced, totals.live)}</Text>
          <View style={styles.totalsRow}>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {W.staked} <Text style={[TYPE.data, { color: color.ink }]}>{money(totals.stakedBase)}</Text>
            </Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {W.worth} <Text style={[TYPE.data, { color: color.ink }]}>{money(totals.equityBase)}</Text>
            </Text>
            <Text style={[TYPE.data, { color: pnlInk }]}>{formatBaseUnits(totals.pnlBase, decimals, { signed: true })}</Text>
          </View>
        </View>
      ) : null}
      {live.map(card)}
      {done.length > 0 ? <Text style={[TYPE.labelMicro, styles.doneHead, { color: color.inkMuted }]}>{W.settledTitle}</Text> : null}
      {done.map(card)}
    </View>
  );
}

function PositionRow({ position, symbol, decimals, nowMs, writes, report, onReview }: {
  position: LeveragePosition;
  symbol: string;
  decimals: number;
  nowMs: number;
  writes: Writes;
  report: Report;
  onReview: (request: ReviewRequest) => void;
}) {
  const market = useMarket(position.marketId);
  const marketKnown = market !== null && isOk(market);
  const markReading = useLeverageMark(position.status === "live" ? position.positionId : null);
  const mark = markReading && isOk(markReading) ? markReading.value : null;
  const id = position.positionId.toString();
  useEffect(() => report(id, mark), [report, id, mark]);
  const view = marketKnown && market.value ? { asset: market.value.asset, intervalSec: market.value.intervalSec } : null;
  const name = view ? `${view.asset} ${formatCadence(view.intervalSec)}` : "this Window";
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;

  const reviewClose = (p: LeveragePosition, m: LeverageMark) => {
    // The mark is what the book pays for the contracts; the reserve's front is repaid out of it first.
    const floor = (m.markBase * CLOSE_FLOOR_BPS) / 10_000n;
    const yoursAtFloor = floor > p.frontedBase ? floor - p.frontedBase : 0n;
    const worst = p.stakeBase > yoursAtFloor ? p.stakeBase - yoursAtFloor : 0n;
    onReview({
      title: `Close your ${name} short`,
      lines: [
        { label: "The book pays now", value: money(m.markBase) },
        { label: "Reserve repaid first", value: money(p.frontedBase), tone: "muted" },
        { label: W.worth, value: money(shortPnl(p, m.markBase).equityBase), tone: "accent" },
        { label: "The least the book may pay", value: money(floor), hint: "Refused rather than filled worse if the book moves" },
        { label: W.staked, value: money(p.stakeBase) },
      ],
      maxLoss: money(worst),
      confirmLabel: "Slide to close",
      send: async () => {
        await writes.close(p.positionId, p.marketId, floor, decimals, symbol);
        report(id, null);
        return null;
      },
    });
  };

  const reviewSettle = (p: LeveragePosition) =>
    onReview({
      title: `Settle your ${name} short`,
      lines: [
        { label: W.staked, value: money(p.stakeBase) },
        { label: "Pays", value: "What the contracts paid, reserve repaid first" },
      ],
      maxLoss: null,
      confirmLabel: "Slide to settle",
      send: async () => {
        await writes.settle(p.positionId, p.marketId);
        return null;
      },
    });

  const reviewClaim = (p: LeveragePosition) =>
    onReview({
      title: `Claim from your ${name} short`,
      lines: [{ label: "To your wallet", value: money(p.owedBase), tone: "profit" }],
      maxLoss: null,
      confirmLabel: "Slide to claim",
      tone: "profit",
      send: async () => {
        await writes.claim(p.positionId, p.marketId, p.owedBase, decimals, symbol);
        return null;
      },
    });

  return (
    <ShortPositionCard
      position={position}
      market={view}
      marketKnown={marketKnown}
      mark={mark}
      symbol={symbol}
      decimals={decimals}
      nowMs={nowMs}
      busy={writes.busy}
      canSign={writes.canSign && writes.address === position.owner}
      onClose={reviewClose}
      onSettle={reviewSettle}
      onClaim={reviewClaim}
    />
  );
}

function sameMark(a: LeverageMark | null, b: LeverageMark | null): boolean {
  if (a === null || b === null) return a === b;
  return a.markBase === b.markBase && a.filledRaw === b.filledRaw && a.lineBase === b.lineBase && a.knockable === b.knockable;
}

const styles = StyleSheet.create({
  book: { gap: 10 },
  totals: { borderRadius: RADIUS.md, padding: 12, gap: 6 },
  totalsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  doneHead: { marginTop: 8 },
});
