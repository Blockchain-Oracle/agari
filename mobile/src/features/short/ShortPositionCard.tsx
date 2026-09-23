import { formatCadence, SETTLING } from "@agari/core/copy";
import { shortHealth, shortMarkPriceRaw, shortPnl, shortPriced, shortResult, type LeverageMark, type LeveragePosition } from "@agari/core/leverage";
import { countdown } from "@agari/core/lifecycle";
import { bpsToOddsCents, formatBaseUnits, priceRawToBps, shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeverageBusyKey } from "@/features/leverage";
import { SHORT } from "@/features/short/copy";
import { Button, Pill } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Clock } from "./Clock";

const W = SHORT.positions;

export interface ShortPositionCardProps {
  position: LeveragePosition;
  /** The Window's asset and cadence; null while the read is in flight, or for a Window this app does not list. */
  market: { asset: string; intervalSec: number } | null;
  marketKnown: boolean;
  mark: LeverageMark | null;
  symbol: string;
  decimals: number;
  nowMs: number;
  busy: LeverageBusyKey | null;
  canSign: boolean;
  onClose: (position: LeveragePosition, mark: LeverageMark) => void;
  onSettle: (position: LeveragePosition) => void;
  onClaim: (position: LeveragePosition) => void;
}

// 21st: ssychui/trade-journal-table — the status pill, the entry → now pair and the signed P&L cell, as a card.
/**
 * web's `features/short/ShortPositionCard.tsx`: one short as a position. Every figure is the chain's or a difference
 * of two: entry and the mark's price, equity against stake, the fall that reaches the knock-out line. A position the
 * book cannot take whole is not marked at all — the reserve would refuse that exit.
 */
export function ShortPositionCard(props: ShortPositionCardProps) {
  const { position, market, marketKnown, mark, symbol, decimals, nowMs, busy, canSign, onClose, onSettle, onClaim } = props;
  const { color } = useTheme();
  const live = position.status === "live";
  const settling = live && market && nowMs > 0 ? (countdown(nowMs, position.expirySec, market.intervalSec).settling ?? false) : false;
  const priced = shortPriced(position, mark);
  const multiple = Math.round(position.leverageBps / 1_000) / 10;
  const id = position.positionId.toString();
  const name = market?.asset ?? (marketKnown ? shortHex(position.marketId, 4, 4) : "…");

  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline, opacity: live ? 1 : 0.85 }]}>
      <View style={styles.head}>
        {market ? <AssetDisc asset={market.asset} size={28} /> : null}
        <Pressable onPress={() => router.push(`/markets/${position.marketId}`)} accessibilityRole="link" accessibilityLabel={`Open the ${name} Window`} hitSlop={8}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{name}</Text>
        </Pressable>
        <Pill label={`${multiple}× down`} tone="loss" />
        {market ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{formatCadence(market.intervalSec)}</Text> : null}
        <View style={styles.flex} />
        {live && market && !settling ? (
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            <Clock expirySec={position.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {SHORT.picker.left}
          </Text>
        ) : null}
        {settling ? <Pill label={SETTLING} tone="warning" /> : null}
        {!live ? <Pill label={resultWord(position)} tone={resultTone(position)} /> : null}
      </View>

      {live ? <LiveBody {...props} priced={priced} /> : <DoneBody position={position} decimals={decimals} symbol={symbol} />}

      <View style={styles.foot}>
        {live && settling && canSign ? (
          <Button label={busy === `settle:${id}` ? W.settling : W.settle} variant="secondary" loading={busy === `settle:${id}`} onPress={() => onSettle(position)} />
        ) : null}
        {live && !settling && canSign && priced && mark ? (
          <Button label={busy === `close:${id}` ? W.closing : W.close} loading={busy === `close:${id}`} onPress={() => onClose(position, mark)} />
        ) : null}
        {position.owedBase > 0n ? (
          <>
            <Text style={[TYPE.caption, { color: color.profit }]}>{W.owed(formatBaseUnits(position.owedBase, decimals), symbol)}</Text>
            {canSign ? (
              <Button label={busy === `claim:${id}` ? W.claiming : W.claim} variant="profit" loading={busy === `claim:${id}`} onPress={() => onClaim(position)} />
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function LiveBody({ position, mark, decimals, symbol, priced }: ShortPositionCardProps & { priced: boolean }) {
  const { color } = useTheme();
  const entryCents = bpsToOddsCents(priceRawToBps(position.entryPriceRaw, decimals));
  if (!priced || !mark) {
    return (
      <View style={styles.body}>
        <Figures position={position} decimals={decimals} symbol={symbol} entryCents={entryCents} nowCents={null} worth={null} />
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          <Text style={{ color: color.warning }}>{W.unpriced}</Text> {W.unpricedWhy}
        </Text>
      </View>
    );
  }
  const pnl = shortPnl(position, mark.markBase);
  const health = shortHealth(mark, position.frontedBase);
  const nowCents = bpsToOddsCents(priceRawToBps(shortMarkPriceRaw(position, mark.markBase), decimals));
  const lineInk = { "at-line": color.loss, close: color.warning, unfronted: color.inkMuted, clear: color.inkSecondary }[health.band];
  const lineText =
    health.band === "at-line"
      ? W.atLine
      : health.band === "unfronted"
        ? W.noLine
        : `${W.drop(`${Math.round((health.dropToLineBps ?? 0) / 100)}%`)} · ${W.line(formatBaseUnits(mark.lineBase, decimals), symbol)}`;
  return (
    <View style={styles.body}>
      <Figures position={position} decimals={decimals} symbol={symbol} entryCents={entryCents} nowCents={nowCents} worth={pnl} />
      <Text style={[TYPE.caption, { color: lineInk }]}>{lineText}</Text>
    </View>
  );
}

function Figures({ position, decimals, symbol, entryCents, nowCents, worth }: {
  position: LeveragePosition;
  decimals: number;
  symbol: string;
  entryCents: number;
  nowCents: number | null;
  worth: { equityBase: bigint; pnlBase: bigint } | null;
}) {
  const { color } = useTheme();
  const pnlInk = worth === null || worth.pnlBase === 0n ? color.inkSecondary : worth.pnlBase > 0n ? color.profit : color.loss;
  return (
    <View style={styles.figs}>
      <Fig label={W.size} value={formatBaseUnits(position.quantityRaw, decimals, { minDp: 0, maxDp: 2 })} />
      <Fig label={W.entry} value={`${entryCents}¢${nowCents !== null ? ` → ${nowCents}¢` : ""}`} />
      <Fig label={W.staked} value={`${formatBaseUnits(position.stakeBase, decimals)} ${symbol}`} />
      <View style={styles.fig}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{W.worth}</Text>
        <Text style={[TYPE.data, { color: color.ink }]}>{worth ? `${formatBaseUnits(worth.equityBase, decimals)} ${symbol}` : "—"}</Text>
        {worth ? <Text style={[TYPE.data, { color: pnlInk }]}>{formatBaseUnits(worth.pnlBase, decimals, { signed: true })}</Text> : null}
      </View>
    </View>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.fig}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.data, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

function DoneBody({ position, decimals, symbol }: { position: LeveragePosition; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const result = shortResult(position);
  const ink = result.pnlBase > 0n ? color.profit : result.pnlBase < 0n ? color.loss : color.inkSecondary;
  return (
    <View style={styles.done}>
      <Text style={[TYPE.data, { color: color.ink }]}>
        {position.returnedBase > 0n ? W.back(formatBaseUnits(position.returnedBase, decimals), symbol) : W.nothingBack}
      </Text>
      <Text style={[TYPE.data, { color: ink }]}>{formatBaseUnits(result.pnlBase, decimals, { signed: true })}</Text>
    </View>
  );
}

function resultWord(position: LeveragePosition): string {
  if (position.status === "knocked-out") return W.result.knockedOut;
  if (position.status === "closed") return W.result.closed;
  if (position.returnedBase === 0n) return W.result.lost;
  return position.returnedBase > position.stakeBase ? W.result.won : W.result.settled;
}

function resultTone(position: LeveragePosition): "profit" | "loss" | "neutral" {
  if (position.returnedBase > position.stakeBase) return "profit";
  if (position.status === "knocked-out" || position.returnedBase === 0n) return "loss";
  return "neutral";
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  flex: { flex: 1 },
  body: { gap: 8 },
  figs: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  fig: { width: "50%", gap: 2 },
  foot: { gap: 8 },
  done: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
