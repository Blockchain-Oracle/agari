import type { MakerWindowView } from "@agari/core/maker";
import { formatCadence } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { BoundRow } from "@/features/earn/bounds";
import { EARN } from "@/features/earn/copy";
import { money2 } from "@/features/earn/format";
import type { EarnBusy } from "@/features/earn/useEarnWrites";
import { FONT } from "~/theme";
import { useEarnParlay } from "./EarnKit";
import { SlipEmpty } from "./EarnParts";

interface WindowsTableProps {
  open: MakerWindowView[];
  history: MakerWindowView[];
  /** Every Window the rows name, read in one round by the screen; a row whose Window has not landed prints "…". */
  markets: ReadonlyMap<MarketId, EventMarket>;
  decimals: number;
  symbol: string;
  nowMs: number;
  busy: EarnBusy | null;
  canSign: boolean;
  onMerge: (marketId: MarketId) => void;
  onSettle: (marketId: MarketId) => void;
}

/** The table's columns at their laid-out widths (web's auto table scrolls sideways inside `.ea-table-wrap` on a phone). */
const COLS = [168, 104, 150, 208, 132] as const;

type RowProps = { view: MakerWindowView; market: EventMarket | null; first: boolean } & Omit<WindowsTableProps, "open" | "history" | "markets">;

function Row({ view, market, first, decimals, symbol, nowMs, busy, canSign, onMerge, onSettle }: RowProps) {
  const { color, t } = useEarnParlay();
  const { windows } = EARN;
  const closed = market !== null && nowMs > 0 && market.expirySec * 1000 <= nowMs;
  const pairs = view.yesRaw < view.noRaw ? view.yesRaw : view.noRaw;
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });
  let state: string;
  if (view.settled) state = windows.settled;
  else if (closed) state = windows.closed;
  else if (pairs > 0n) state = windows.paired(contracts(pairs));
  else if (view.yesRaw > 0n || view.noRaw > 0n) state = windows.oneSided(view.yesRaw > 0n ? "UP" : "DOWN", contracts(view.yesRaw > 0n ? view.yesRaw : view.noRaw));
  else state = windows.resting;
  const mergeBusy = busy === `merge:${view.marketId}`;
  const settleBusy = busy === `settle:${view.marketId}`;
  const td = [styles.td, { borderTopColor: t.tdRule, borderTopWidth: first ? 0 : 1 }];
  const ink = { color: color.ink };
  return (
    <View style={styles.tr}>
      <View style={[td, { width: COLS[0] }]}>
        <Text style={[styles.tdText, ink]}>
          {market ? `${market.asset} ${formatCadence(market.intervalSec)}` : "…"}
          <Text style={{ color: color.inkMuted }}> · {view.quoteCount} quotes</Text>
        </Text>
      </View>
      <View style={[td, { width: COLS[1] }]}>
        <Text style={[styles.tdText, styles.num, ink]}>{money2(view.deployedBase, decimals)}</Text>
      </View>
      <View style={[td, { width: COLS[2] }]}>
        <Text style={[styles.tdText, styles.num, ink]}>
          {contracts(view.yesRaw)} / {contracts(view.noRaw)}
        </Text>
      </View>
      <View style={[td, styles.stateCell, { width: COLS[3] }]}>
        <Text style={[styles.tdText, ink]}>{state}</Text>
        {canSign && !view.settled && pairs > 0n ? <Crank label={mergeBusy ? windows.busy : windows.merge} disabled={mergeBusy} onPress={() => onMerge(view.marketId)} /> : null}
        {canSign && !view.settled && closed ? <Crank label={settleBusy ? windows.busy : windows.settle} disabled={settleBusy} onPress={() => onSettle(view.marketId)} /> : null}
      </View>
      <View style={[td, { width: COLS[4] }]}>
        <Text style={[styles.tdText, styles.num, ink]}>
          {view.realizedBase === null ? "–" : `${view.realizedBase < 0n ? "−" : "+"}${money2(view.realizedBase < 0n ? -view.realizedBase : view.realizedBase, decimals)} ${symbol}`}
        </Text>
      </View>
    </View>
  );
}

/** web's `.pl-settle` (`.ea-row-btn` adds its 8 px lead in the table; `flush` drops it on the slip): the permissionless crank as a pill. */
export function Crank({ label, disabled, onPress, flush = false }: { label: string; disabled: boolean; onPress: () => void; flush?: boolean }) {
  const { color, t } = useEarnParlay();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.crank, flush && styles.flush, { borderColor: t.vermilion50, backgroundColor: pressed ? t.vermilion10 : t.clear, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={[styles.crankText, { color: color.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** web's `features/earn/WindowsTable.tsx`: one row per Window the maker is on, then the last settled ones. */
export function WindowsTable(props: WindowsTableProps) {
  const { color, t } = useEarnParlay();
  const { windows } = EARN;
  const rows = [...props.open, ...props.history.filter((h) => h.settled).slice(0, 10)];
  if (rows.length === 0) return <SlipEmpty text={windows.empty} />;
  const heads: [string, boolean][] = [
    [windows.window, false],
    [windows.deployed, true],
    [`${windows.inventory} UP / DOWN`, true],
    [windows.state, false],
    [windows.result, true],
  ];
  return (
    <View style={[styles.wrap, { borderColor: t.tableBorder, backgroundColor: t.tableBg }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tr, { borderBottomWidth: 1, borderBottomColor: t.thRule }]}>
            {heads.map(([label, num], i) => (
              <View key={label} style={[styles.th, { width: COLS[i] }]}>
                <Text style={[styles.thText, num && styles.num, { color: color.inkMuted }]}>{label}</Text>
              </View>
            ))}
          </View>
          {rows.map((view, i) => (
            <Row
              key={`${view.marketId}:${view.settled ? "s" : "o"}`}
              view={view}
              first={i === 0}
              market={props.markets.get(view.marketId) ?? null}
              decimals={props.decimals}
              symbol={props.symbol}
              nowMs={props.nowMs}
              busy={props.busy}
              canSign={props.canSign}
              onMerge={props.onMerge}
              onSettle={props.onSettle}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** web's `features/earn/ReserveBounds.tsx`: §02 on a house reserve — the deployed program's own tunables, then the risk. */
export function ReserveBounds({ rows, risk }: { rows: readonly BoundRow[]; risk: string }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={[styles.bounds, { borderColor: t.tableBorder, backgroundColor: t.tableBg }]}>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.bound, { borderTopColor: t.tdRule, borderTopWidth: i === 0 ? 0 : 1 }]}>
          <Text style={[styles.boundK, { color: color.inkMuted }]}>{row.label}</Text>
          <View style={styles.boundV}>
            <Text style={[styles.boundN, { color: color.ink }]}>{row.value}</Text>
            <Text style={[styles.boundNote, { color: color.inkMuted }]}>{row.note}</Text>
          </View>
        </View>
      ))}
      <Risk text={risk} />
    </View>
  );
}

/** web's `NotOnThisCluster` (HouseEarn.tsx): the reserve's own words, and what it depends on, on the bounds surface. */
export function NotOnThisCluster({ blurb, why }: { blurb: string; why: string }) {
  const { color, t } = useEarnParlay();
  return (
    <View style={styles.container}>
      <View style={[styles.bounds, { borderColor: t.tableBorder, backgroundColor: t.tableBg }]}>
        <Text style={[styles.boundNote, { color: color.inkMuted }]}>{blurb}</Text>
        <Risk text={why} />
      </View>
    </View>
  );
}

function Risk({ text }: { text: string }) {
  const { t } = useEarnParlay();
  return <Text style={[styles.risk, { borderTopColor: t.riskRule, color: t.riskInk }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18 },
  wrap: { marginBottom: 40, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tr: { flexDirection: "row" },
  th: { paddingVertical: 12, paddingHorizontal: 16 },
  thText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.62, textTransform: "uppercase" },
  td: { paddingVertical: 12, paddingHorizontal: 16 },
  tdText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  num: { textAlign: "right", fontVariant: ["tabular-nums"] },
  stateCell: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 4 },
  crank: { marginLeft: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1 },
  flush: { marginLeft: 0 },
  crankText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.45, textTransform: "uppercase" },
  bounds: { marginBottom: 40, borderRadius: 16, borderWidth: 1, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16 },
  bound: { gap: 4, paddingVertical: 14 },
  boundK: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.62, textTransform: "uppercase" },
  boundV: { gap: 4 },
  boundN: { fontFamily: FONT.dataRegular, fontSize: 15, lineHeight: 24, fontVariant: ["tabular-nums"] },
  boundNote: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  risk: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 19.5 },
});
