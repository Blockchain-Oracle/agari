import type { MakerWindowView } from "@agari/core/maker";
import { formatCadence } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import { money2 } from "@/features/earn/format";
import type { BoundRow } from "@/features/earn/bounds";
import type { EarnBusy } from "@/features/earn/useEarnWrites";
import { Button, EmptyState } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";

const W = EARN.windows;

interface WindowsListProps {
  open: MakerWindowView[];
  history: MakerWindowView[];
  markets: ReadonlyMap<MarketId, EventMarket>;
  decimals: number;
  symbol: string;
  nowMs: number;
  busy: EarnBusy | null;
  canSign: boolean;
  onMerge: (marketId: MarketId, label: string) => void;
  onSettle: (marketId: MarketId, label: string) => void;
}

/**
 * web's `features/earn/WindowsTable.tsx` as one card per row (a five-column table does not fit a phone): the Window,
 * what is deployed, the UP / DOWN inventory, its state with the merge or settle it allows, and the realized result.
 */
export function WindowsList(props: WindowsListProps) {
  const rows = [...props.open, ...props.history.filter((h) => h.settled).slice(0, 10)];
  if (rows.length === 0) return <EmptyState why={W.empty} />;
  return (
    <View style={styles.list}>
      {rows.map((view) => (
        <WindowCard key={`${view.marketId}:${view.settled ? "s" : "o"}`} view={view} market={props.markets.get(view.marketId) ?? null} {...props} />
      ))}
    </View>
  );
}

function WindowCard({ view, market, decimals, symbol, nowMs, busy, canSign, onMerge, onSettle }: { view: MakerWindowView; market: EventMarket | null } & WindowsListProps) {
  const { color } = useTheme();
  const closed = market !== null && nowMs > 0 && market.expirySec * 1000 <= nowMs;
  const pairs = view.yesRaw < view.noRaw ? view.yesRaw : view.noRaw;
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });
  const label = market ? `${market.asset} ${formatCadence(market.intervalSec)}` : "…";
  let state: string;
  if (view.settled) state = W.settled;
  else if (closed) state = W.closed;
  else if (pairs > 0n) state = W.paired(contracts(pairs));
  else if (view.yesRaw > 0n || view.noRaw > 0n) state = W.oneSided(view.yesRaw > 0n ? "UP" : "DOWN", contracts(view.yesRaw > 0n ? view.yesRaw : view.noRaw));
  else state = W.resting;
  const result = view.realizedBase;
  const mergeBusy = busy === `merge:${view.marketId}`;
  const settleBusy = busy === `settle:${view.marketId}`;
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.head}>
        {market ? <AssetDisc asset={market.asset} size={24} /> : null}
        <Text style={[TYPE.bodyStrong, styles.flex, { color: color.ink }]}>
          {label} <Text style={[TYPE.caption, { color: color.inkMuted }]}>· {view.quoteCount} quotes</Text>
        </Text>
        <Text style={[TYPE.data, { color: result === null ? color.inkMuted : result < 0n ? color.loss : color.profit }]}>
          {result === null ? "–" : `${result < 0n ? "−" : "+"}${money2(result < 0n ? -result : result, decimals)} ${symbol}`}
        </Text>
      </View>
      <View style={styles.figs}>
        <Fig label={W.deployed} value={money2(view.deployedBase, decimals)} />
        <Fig label={`${W.inventory} UP / DOWN`} value={`${contracts(view.yesRaw)} / ${contracts(view.noRaw)}`} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{state}</Text>
      {canSign && !view.settled && pairs > 0n ? (
        <Button label={mergeBusy ? W.busy : W.merge} variant="secondary" size="sm" loading={mergeBusy} onPress={() => onMerge(view.marketId, label)} />
      ) : null}
      {canSign && !view.settled && closed ? (
        <Button label={settleBusy ? W.busy : W.settle} variant="secondary" size="sm" loading={settleBusy} onPress={() => onSettle(view.marketId, label)} />
      ) : null}
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

/** web's `ReserveBounds`: the deployed program's own tunables, each with what it means for a supplier; then the risk. */
export function ReserveBounds({ rows, risk }: { rows: readonly BoundRow[]; risk: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.label} style={[styles.bound, { borderBottomColor: color.hairline }]}>
          <View style={styles.boundHead}>
            <Text style={[TYPE.caption, styles.flex, { color: color.inkSecondary }]}>{row.label}</Text>
            <Text style={[TYPE.data, { color: color.ink }]}>{row.value}</Text>
          </View>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{row.note}</Text>
        </View>
      ))}
      <Text style={[TYPE.caption, { color: color.warning }]}>{risk}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  figs: { flexDirection: "row", gap: 12 },
  fig: { flex: 1, gap: 2 },
  bound: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10, gap: 4 },
  boundHead: { flexDirection: "row", alignItems: "baseline", gap: 12 },
});
