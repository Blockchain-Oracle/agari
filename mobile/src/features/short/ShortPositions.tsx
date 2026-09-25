import { shortBookTotals, type LeverageMark, type LeveragePosition } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import { useLeverageMark, useMarket, useMyLeveragePositions } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLeverageWrites } from "@/features/leverage";
import { SHORT } from "@/features/short/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { ConnectButton, Money } from "./PageParts";
import { ShortPositionCard } from "./ShortPositionCard";

const W = SHORT.positions;

type Writes = ReturnType<typeof useLeverageWrites>;
type Report = (positionId: string, mark: LeverageMark | null) => void;

interface Props {
  symbol: string;
  decimals: number;
  nowMs: number;
}

/**
 * web's `features/short/ShortPositions.tsx`: connect or empty in the `.sh-empty` panel; otherwise the one totals line
 * (the cards' own arithmetic, `shortBookTotals`), the live cards, then "Closed shorts". Each card reads its own mark
 * and reports it up by value, so a poll returning the same mark re-renders nothing.
 */
export function ShortPositions({ symbol, decimals, nowMs }: Props) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
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
  const panel = [styles.empty, { borderColor: t.emptyBorder, backgroundColor: t.emptyBg }];

  if (address === null) {
    return (
      <View style={panel}>
        <Text style={[styles.emptyT, { color: color.ink }]}>{W.connect}</Text>
        <ConnectButton />
      </View>
    );
  }
  if (held.length === 0) {
    return (
      <View style={panel}>
        <Text style={[styles.emptyT, { color: color.ink }]}>{W.empty}</Text>
        <Text style={[styles.emptyD, { color: color.inkMuted }]}>{W.emptyBody}</Text>
      </View>
    );
  }

  const card = (position: LeveragePosition) => (
    <Row key={position.positionId.toString()} position={position} symbol={symbol} decimals={decimals} nowMs={nowMs} writes={writes} report={report} />
  );

  return (
    <View>
      {live.length > 0 ? (
        <>
          <View style={styles.totals}>
            <Text style={[styles.totalsN, { color: color.inkMuted }]}>{W.totals(totals.priced, totals.live)}</Text>
            <View style={styles.flex} />
            <Text style={[styles.totalsK, { color: color.inkDisabled }]}>{W.staked}</Text>
            <Money value={totals.stakedBase} decimals={decimals} symbol={symbol} style={[styles.totalsV, { color: color.ink }]} />
            <Text style={[styles.totalsK, { color: color.inkDisabled }]}>{W.worth}</Text>
            <Money value={totals.equityBase} decimals={decimals} symbol={symbol} style={[styles.totalsV, { color: color.ink }]} />
            <Money value={totals.pnlBase} decimals={decimals} tone="pnl" style={styles.totalsV} />
          </View>
          <View style={styles.list}>{live.map(card)}</View>
        </>
      ) : null}
      {done.length > 0 ? (
        <>
          <Text style={[styles.doneHead, { color: color.inkDisabled }]}>{W.settledTitle}</Text>
          <View style={styles.list}>{done.map(card)}</View>
        </>
      ) : null}
    </View>
  );
}

function Row({ position, symbol, decimals, nowMs, writes, report }: {
  position: LeveragePosition;
  symbol: string;
  decimals: number;
  nowMs: number;
  writes: Writes;
  report: Report;
}) {
  const market = useMarket(position.marketId);
  const marketKnown = market !== null && isOk(market);
  const reading = useLeverageMark(position.status === "live" ? position.positionId : null);
  const mark = reading && isOk(reading) ? reading.value : null;
  const id = position.positionId.toString();
  useEffect(() => report(id, mark), [report, id, mark]);
  return (
    <ShortPositionCard
      position={position}
      market={marketKnown && market.value ? { asset: market.value.asset, intervalSec: market.value.intervalSec } : null}
      marketKnown={marketKnown}
      mark={mark}
      symbol={symbol}
      decimals={decimals}
      nowMs={nowMs}
      busy={writes.busy}
      canSign={writes.canSign && writes.address === position.owner}
      onClose={(p, min) => void writes.close(p.positionId, p.marketId, min, decimals, symbol).then(() => report(id, null))}
      onSettle={(p) => void writes.settle(p.positionId, p.marketId)}
      onClaim={(p) => void writes.claim(p.positionId, p.marketId, p.owedBase, decimals, symbol)}
    />
  );
}

function sameMark(a: LeverageMark | null, b: LeverageMark | null): boolean {
  if (a === null || b === null) return a === b;
  return a.markBase === b.markBase && a.filledRaw === b.filledRaw && a.lineBase === b.lineBase && a.knockable === b.knockable;
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 32, paddingHorizontal: 20, borderWidth: 1, borderRadius: 16, alignItems: "center" },
  emptyT: { marginBottom: 8, fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4, textAlign: "center" },
  emptyD: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5, textAlign: "center" },
  totals: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 6, marginBottom: 14 },
  totalsN: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
  flex: { flexGrow: 1 },
  totalsK: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26, textTransform: "uppercase" },
  totalsV: { fontSize: 12, lineHeight: 19.2 },
  list: { gap: 12 },
  doneHead: { marginTop: 28, marginBottom: 12, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.62, textTransform: "uppercase" },
});
