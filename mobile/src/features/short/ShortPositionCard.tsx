import { formatCadence, SETTLING } from "@agari/core/copy";
import { shortHealth, shortMarkPriceRaw, shortPnl, shortPriced, shortResult, type LeverageMark, type LeveragePosition } from "@agari/core/leverage";
import { countdown } from "@agari/core/lifecycle";
import { bpsToOddsCents, formatBaseUnits, priceRawToBps, shortHex } from "@agari/core/units";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeverageBusyKey } from "@/features/leverage";
import { SHORT } from "@/features/short/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { Clock } from "./Clock";
import { Money } from "./PageParts";

/** web's `CLOSE_FLOOR_BPS`: the owner's slippage guard on a close; the book may move between the mark and the send. */
const CLOSE_FLOOR_BPS = 9_700n;
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
  onClose: (position: LeveragePosition, minProceedsBase: bigint) => void;
  onSettle: (position: LeveragePosition) => void;
  onClaim: (position: LeveragePosition) => void;
}

/**
 * web's `features/short/ShortPositionCard.tsx` (`.sh-pos`): the head (mark, asset, multiple, cadence, time left or
 * the result), the four figures, the distance to the knock-out line, and the mono Close · Settle · Claim actions.
 * A position the book cannot take whole is not marked — the reserve would refuse that exit.
 */
export function ShortPositionCard(props: ShortPositionCardProps) {
  const { position, market, marketKnown, mark, symbol, decimals, nowMs, busy, canSign, onClose, onSettle, onClaim } = props;
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const live = position.status === "live";
  const settling = live && market && nowMs > 0 ? (countdown(nowMs, position.expirySec, market.intervalSec).settling ?? false) : false;
  const priced = shortPriced(position, mark);
  const multiple = Math.round(position.leverageBps / 1_000) / 10;
  const id = position.positionId.toString();

  return (
    <View style={[styles.pos, { borderColor: t.posBorder, backgroundColor: t.posBg, opacity: live ? 1 : 0.72 }]}>
      <View style={styles.head}>
        {market ? <AssetDisc asset={market.asset} size={26} /> : null}
        <Pressable onPress={() => router.push(`/markets/${position.marketId}`)} accessibilityRole="link" hitSlop={8}>
          {({ pressed }) => (
            <Text style={[styles.asset, { color: pressed ? color.accent : color.ink }]}>{market?.asset ?? (marketKnown ? shortHex(position.marketId, 4, 4) : "…")}</Text>
          )}
        </Pressable>
        <Text style={[styles.x, { color: color.accent }]}>{multiple}×</Text>
        {market ? <Text style={[styles.meta, { color: color.inkDisabled }]}>{formatCadence(market.intervalSec)}</Text> : null}
        <View style={styles.flex} />
        {live && market && !settling ? (
          <Text style={[styles.meta, { color: color.inkDisabled }]}>
            <Clock expirySec={position.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {SHORT.picker.left}
          </Text>
        ) : null}
        {settling ? <Text style={[styles.meta, { color: color.inkDisabled }]}>{SETTLING}</Text> : null}
        {!live ? <Text style={[styles.state, { color: color.inkMuted }]}>{resultWord(position)}</Text> : null}
      </View>

      {live ? <LiveBody {...props} priced={priced} /> : <DoneBody position={position} decimals={decimals} symbol={symbol} />}

      <View style={styles.foot}>
        {live && settling && canSign ? <Act label={busy === `settle:${id}` ? W.settling : W.settle} disabled={busy === `settle:${id}`} onPress={() => onSettle(position)} /> : null}
        {live && !settling && canSign && priced && mark ? (
          <Act primary label={busy === `close:${id}` ? W.closing : W.close} disabled={busy === `close:${id}`} onPress={() => onClose(position, (mark.markBase * CLOSE_FLOOR_BPS) / 10_000n)} />
        ) : null}
        {position.owedBase > 0n ? (
          <>
            <Text style={[styles.owed, { color: color.inkMuted }]}>{W.owed(formatBaseUnits(position.owedBase, decimals), symbol)}</Text>
            {canSign ? <Act primary label={busy === `claim:${id}` ? W.claiming : W.claim} disabled={busy === `claim:${id}`} onPress={() => onClaim(position)} /> : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

/** `.sh-act`: a mono uppercase word; the primary one in vermilion. */
function Act({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} hitSlop={10} style={{ opacity: disabled ? 0.4 : 1 }}>
      {({ pressed }) => (
        <Text style={[styles.act, { color: primary ? (pressed ? color.accentPressed : color.accent) : pressed ? color.ink : color.inkMuted }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function LiveBody({ position, mark, decimals, symbol, priced }: ShortPositionCardProps & { priced: boolean }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const entryCents = bpsToOddsCents(priceRawToBps(position.entryPriceRaw, decimals));
  if (!priced || !mark) {
    return (
      <View style={styles.body}>
        <Figures position={position} decimals={decimals} symbol={symbol} entryCents={entryCents} nowCents={null} worth={null} />
        <Text style={[styles.unpriced, { color: color.inkDisabled }]}>
          <Text style={{ color: t.warn }}>{W.unpriced}</Text> {W.unpricedWhy}
        </Text>
      </View>
    );
  }
  const pnl = shortPnl(position, mark.markBase);
  const health = shortHealth(mark, position.frontedBase);
  const nowCents = bpsToOddsCents(priceRawToBps(shortMarkPriceRaw(position, mark.markBase), decimals));
  const warn = health.band === "close" || health.band === "at-line";
  return (
    <View style={styles.body}>
      <Figures position={position} decimals={decimals} symbol={symbol} entryCents={entryCents} nowCents={nowCents} worth={pnl} />
      <Text style={[styles.line, { color: warn ? t.warn : color.inkDisabled }, health.band === "at-line" ? styles.lineStrong : null]}>
        {health.band === "at-line"
          ? W.atLine
          : health.band === "unfronted"
            ? W.noLine
            : `${W.drop(`${Math.round((health.dropToLineBps ?? 0) / 100)}%`)} · ${W.line(formatBaseUnits(mark.lineBase, decimals), symbol)}`}
      </Text>
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
  return (
    <View style={styles.figs}>
      <Fig label={W.size}>{formatBaseUnits(position.quantityRaw, decimals, { minDp: 0, maxDp: 2 })}</Fig>
      <Fig label={W.entry}>
        {entryCents}¢{nowCents !== null ? <Text style={{ color: color.inkMuted }}> → {nowCents}¢</Text> : null}
      </Fig>
      <Fig label={W.staked}>
        <Money value={position.stakeBase} decimals={decimals} symbol={symbol} />
      </Fig>
      <View style={styles.fig}>
        <Text style={[styles.dt, { color: color.inkDisabled }]}>{W.worth}</Text>
        {worth ? (
          <>
            <Text style={[styles.dd, { color: color.ink }]}>
              <Money value={worth.equityBase} decimals={decimals} symbol={symbol} />
            </Text>
            <Money value={worth.pnlBase} decimals={decimals} tone="pnl" style={styles.pnl} />
          </>
        ) : (
          <Text style={[styles.dd, { color: color.ink }]}>—</Text>
        )}
      </View>
    </View>
  );
}

function Fig({ label, children }: { label: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.fig}>
      <Text style={[styles.dt, { color: color.inkDisabled }]}>{label}</Text>
      <Text style={[styles.dd, { color: color.ink }]}>{children}</Text>
    </View>
  );
}

function DoneBody({ position, decimals, symbol }: { position: LeveragePosition; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const result = shortResult(position);
  return (
    <View style={[styles.body, styles.done]}>
      <Text style={[styles.doneText, { color: color.ink }]}>
        {position.returnedBase > 0n ? W.back(formatBaseUnits(position.returnedBase, decimals), symbol) : W.nothingBack}
      </Text>
      <Money value={result.pnlBase} decimals={decimals} tone="pnl" style={styles.pnlInline} />
    </View>
  );
}

function resultWord(position: LeveragePosition): string {
  if (position.status === "knocked-out") return W.result.knockedOut;
  if (position.status === "closed") return W.result.closed;
  if (position.returnedBase === 0n) return W.result.lost;
  return position.returnedBase > position.stakeBase ? W.result.won : W.result.settled;
}

const styles = StyleSheet.create({
  pos: { paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderRadius: 14 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  asset: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  x: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  state: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  flex: { flexGrow: 1 },
  body: { marginTop: 12 },
  figs: { flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 12 },
  fig: { width: "47%", flexGrow: 1 },
  dt: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.28, textTransform: "uppercase" },
  dd: { fontFamily: FONT.body, fontSize: 13, lineHeight: 16.25, fontVariant: ["tabular-nums"] },
  pnl: { marginTop: 2, fontSize: 11, lineHeight: 17.6 },
  line: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.4 },
  lineStrong: { fontFamily: FONT.dataStrong },
  unpriced: { marginTop: 12, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  done: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 10 },
  doneText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  pnlInline: { fontSize: 11, lineHeight: 17.6 },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 14 },
  owed: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  act: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66, textTransform: "uppercase" },
});
