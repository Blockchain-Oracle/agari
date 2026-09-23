import { diagnosisCopy } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import type { ParlayQuote, ParlayReserveState } from "@agari/core/parlay";
import type { Diagnosis, EventMarket } from "@agari/core/types";
import { formatBaseUnits, oneUnit, parseDecimalToBaseUnits } from "@agari/core/units";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { formatBpsPct, formatLine, formatMultiplier, formatProbPct, parseThinBook, utilizationPct } from "@/features/parlay/format";
import { Button, Field, Row, Rows, Segmented } from "~/components/kit";
import { Clock } from "~/features/short/Clock";
import { Note } from "~/features/short/PageParts";
import { RADIUS, TYPE, useTheme } from "~/theme";
import type { DraftLeg } from "./LegRow";

export type SolveMode = "fixStake" | "fixPayout";

/**
 * The quote without its per-leg price array: React 19.2's dev performance track JSON-stringifies primitive arrays in
 * changed props, and a `bigint[]` throws there ("Do not know how to serialize a BigInt"), which wedges the renderer.
 */
export type TicketQuote = Omit<ParlayQuote, "legPricesRaw">;

export function ticketQuote(quote: ParlayQuote | null): TicketQuote | null {
  if (!quote) return null;
  const { legPricesRaw: _prices, ...rest } = quote;
  return rest;
}
const T = PARLAY.ticket;

export interface ParlayTicketProps {
  legs: readonly DraftLeg[];
  marketOf: (leg: DraftLeg) => EventMarket | null;
  reserve: ParlayReserveState;
  symbol: string;
  nowMs: number;
  quote: TicketQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
  onRetryQuote: () => void;
  solveMode: SolveMode;
  onSolveMode: (mode: SolveMode) => void;
  stakeInput: string;
  onStakeInput: (v: string) => void;
  payoutInput: string;
  onPayoutInput: (v: string) => void;
  walletSpendableBase: bigint | null;
  placing: boolean;
  onReview: () => void;
}

/**
 * web's `features/parlay/ParlayTicket.tsx`: the multiplier the chain quotes, the stake/payout solver, the breakdown
 * per leg, the place control's ladder (pricing → unavailable → build → insufficient → place), the reserve footnote.
 */
export function ParlayTicket(props: ParlayTicketProps) {
  const { legs, marketOf, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote, solveMode, onSolveMode } = props;
  const { stakeInput, onStakeInput, payoutInput, onPayoutInput, walletSpendableBase, placing, onReview } = props;
  const { color } = useTheme();
  const { decimals } = reserve;
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });
  const thin = parseThinBook(quoteError);
  const thinLeg = thin ? legs.findIndex((leg) => leg.marketId === thin.marketId) : -1;
  const needBase = quote ? quote.stakeBase : (parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n);
  const hasEnough = walletSpendableBase !== null && walletSpendableBase >= needBase;

  if (legs.length < 2) {
    return (
      <View style={[styles.ticket, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <TicketHead />
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{T.needTwo}</Text>
      </View>
    );
  }

  const label = placing
    ? T.placing
    : quoteLoading
      ? T.pricing
      : quoteError
        ? T.unavailable
        : !quote
          ? T.build
          : !hasEnough
            ? T.insufficient(symbol)
            : T.place(money(quote.stakeBase), symbol);

  return (
    <View style={styles.col}>
      <View style={[styles.ticket, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <TicketHead />
        <View style={styles.pays}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{T.pays}</Text>
          {quoteLoading ? (
            <ActivityIndicator color={color.accent} style={styles.spinner} />
          ) : (
            <Text style={[TYPE.dataHero, { color: color.accent }]}>{quote ? formatMultiplier(quote.multiplierMilli) : "···"}</Text>
          )}
          {quote && !quoteLoading ? (
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{T.combined(legs.length, formatProbPct(quote.combinedProbRaw, oneUnit(decimals)))}</Text>
          ) : null}
        </View>
        {quote?.correlated ? <Note text={T.correlated} warn /> : null}

        <Segmented
          label="Solve for"
          options={[
            { value: "fixStake", label: T.setStake },
            { value: "fixPayout", label: T.setPayout },
          ]}
          value={solveMode}
          onChange={onSolveMode}
        />
        {solveMode === "fixStake" ? (
          <Field label={T.youPay} value={stakeInput} onChangeText={onStakeInput} placeholder="0.00" numeric suffix={symbol} />
        ) : (
          <Field label={T.youWin} value={payoutInput} onChangeText={onPayoutInput} placeholder="0.00" numeric suffix={symbol} />
        )}
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {solveMode === "fixStake" ? T.wallet(walletSpendableBase !== null ? money(walletSpendableBase) : "…", symbol) : T.ifLands}
        </Text>

        <Rows>
          <Row label={T.youPay} value={quoteLoading ? "…" : quote ? `${money(quote.stakeBase)} ${symbol}` : "···"} strong />
          <Row label={T.youWin} value={quoteLoading ? "…" : quote ? `${money(quote.maxPayoutBase)} ${symbol}` : "···"} tone="accent" />
        </Rows>
        {quote ? <Text style={[TYPE.caption, { color: color.profit }]}>{T.profit(money(quote.maxPayoutBase - quote.stakeBase), symbol)}</Text> : null}

        {quote ? (
          <View style={styles.breakdown}>
            {legs.map((leg, i) => {
              const m = marketOf(leg);
              const bps = quote.legProbBps[i];
              return (
                <View key={leg.key} style={styles.bdRow}>
                  <Text style={[TYPE.caption, styles.bdWhat, { color: color.inkSecondary }]} numberOfLines={1}>
                    <Text style={{ color: leg.side === "up" ? color.profit : color.loss }}>{leg.side === "up" ? "UP" : "DOWN"}</Text>{" "}
                    {m?.openingPriceRaw != null ? formatLine(m.openingPriceRaw, m.asset) : "···"}
                    {m ? ` · ${m.asset} ${formatCadence(m.intervalSec)} · ` : ""}
                    {m ? <Clock expirySec={m.expirySec} intervalSec={m.intervalSec} nowMs={nowMs} style={styles.small} /> : null}
                  </Text>
                  <Text style={[TYPE.data, { color: color.ink }]}>{bps !== undefined ? formatBpsPct(bps) : "·"}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {quoteError ? (
          <Pressable onPress={onRetryQuote} accessibilityRole="button" accessibilityLabel={T.retry} style={[styles.err, { backgroundColor: color.lossWash }]}>
            <Text style={[TYPE.caption, { color: color.loss }]}>
              {thin ? T.thinBook(thinLeg + 1, contracts(thin.filledRaw), contracts(thin.depthRaw)) : diagnosisCopy(quoteError.kind).headline} · {T.retry}
            </Text>
          </Pressable>
        ) : null}

        <Button
          label={label}
          size="lg"
          loading={placing}
          disabled={!quote || quoteLoading || quoteError !== null || !hasEnough || placing}
          onPress={onReview}
        />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {T.footnote}
          {"\n"}
          {reserve.paused ? T.reservePaused : T.reserve(money(reserve.liquidBase), symbol, utilizationPct(reserve.utilizationBps))}
        </Text>
      </View>

      <View style={[styles.trophy, { borderColor: color.hairline }]}>
        <SymbolView name={{ ios: "trophy.fill", android: "emoji_events" }} size={18} tintColor={color.accent} />
        <Text style={[TYPE.caption, styles.trophyText, { color: color.inkSecondary }]}>{T.trophy}</Text>
      </View>
    </View>
  );
}

function TicketHead() {
  const { color } = useTheme();
  return (
    <View style={styles.head}>
      <Text style={[TYPE.title, { color: color.ink }]}>{T.title}</Text>
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{T.tag}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 10 },
  ticket: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  pays: { alignItems: "center", gap: 4, paddingVertical: 6 },
  spinner: { height: 42 },
  breakdown: { gap: 6 },
  bdRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bdWhat: { flex: 1 },
  small: { fontSize: 12 },
  err: { borderRadius: RADIUS.md, padding: 10, minHeight: 44, justifyContent: "center" },
  trophy: { flexDirection: "row", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12, alignItems: "flex-start" },
  trophyText: { flex: 1 },
});
