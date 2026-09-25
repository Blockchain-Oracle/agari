import { diagnosisCopy } from "@agari/core/copy";
import { formatCadence } from "@agari/core/market";
import type { ParlayQuote, ParlayReserveState } from "@agari/core/parlay";
import type { Diagnosis, EventMarket, Signature } from "@agari/core/types";
import { formatBaseUnits, oneUnit, parseDecimalToBaseUnits } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { AlertCircle, Trophy } from "lucide-react-native";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { formatBpsPct, formatLine, formatMultiplier, formatProbPct, parseThinBook, utilizationPct } from "@/features/parlay/format";
import { FONT } from "~/theme";
import { useEarnParlay } from "~/features/earn/EarnKit";
import type { DraftLeg } from "./LegRow";
import { Countdown, Rise, Spinner } from "./ParlayKit";
import { AmountField, ErrorBlock, PlaceButton, Row, type PlaceStep } from "./TicketParts";

export type SolveMode = "fixStake" | "fixPayout";

export interface ParlayTicketProps {
  legs: readonly DraftLeg[];
  marketOf: (leg: DraftLeg) => EventMarket | null;
  reserve: ParlayReserveState;
  symbol: string;
  nowMs: number;
  quote: ParlayQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
  onRetryQuote: () => void;
  solveMode: SolveMode;
  onSolveMode: (mode: SolveMode) => void;
  stakeInput: string;
  onStakeInput: (v: string) => void;
  payoutInput: string;
  onPayoutInput: (v: string) => void;
  /** null until the wallet's sheet answers. */
  walletSpendableBase: bigint | null;
  step: PlaceStep;
  errorTitle: string;
  errorDetail: string;
  txHash: Signature | null;
  onPlace: () => void;
  onReset: () => void;
}

/** web's `features/parlay/ParlayTicket.tsx`: the multiplier, the solver, the breakdown, the place control, the footnotes. */
export function ParlayTicket(props: ParlayTicketProps) {
  const { legs, marketOf, reserve, symbol, nowMs, quote, quoteLoading, quoteError, onRetryQuote, solveMode, onSolveMode } = props;
  const { stakeInput, onStakeInput, payoutInput, onPayoutInput, walletSpendableBase, step, errorTitle, errorDetail, txHash, onPlace, onReset } = props;
  const { color, t } = useEarnParlay();
  const thin = parseThinBook(quoteError);
  const thinLeg = thin ? legs.findIndex((leg) => leg.marketId === thin.marketId) : -1;
  const contracts = (raw: bigint) => formatBaseUnits(raw, reserve.decimals, { minDp: 0, maxDp: 2 });
  const { ticket } = PARLAY;
  const { decimals } = reserve;
  const one = oneUnit(decimals);
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  const stakeText = quote ? money(quote.stakeBase) : "···";
  const payoutText = quote ? money(quote.maxPayoutBase) : "···";
  const needBase = quote ? quote.stakeBase : (parseDecimalToBaseUnits(stakeInput || "0", decimals) ?? 0n);
  const hasEnough = walletSpendableBase !== null && walletSpendableBase >= needBase;
  const mode = (value: SolveMode, label: string) => {
    const on = solveMode === value;
    return (
      <Pressable onPress={() => onSolveMode(value)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.mode, on ? { backgroundColor: t.vermilion15 } : null]}>
        <Text style={[styles.modeText, { color: on ? color.accent : color.inkMuted }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <View style={[styles.ticket, { borderColor: t.plateBorder, backgroundColor: t.plateBg }]}>
        <View style={[styles.head, { borderBottomColor: t.plateRule }]}>
          <Text style={[styles.title, { color: color.ink }]}>{ticket.title}</Text>
          <Text style={[styles.tag, { color: color.inkDisabled }]}>{ticket.tag}</Text>
        </View>

        <View style={styles.body}>
          {legs.length < 2 ? (
            <Text style={[styles.need2, { color: color.inkMuted }]}>{ticket.needTwo}</Text>
          ) : (
            <>
              <View style={styles.pays}>
                <Text style={[styles.paysLabel, { color: color.inkDisabled }]}>{ticket.pays}</Text>
                <View style={styles.paysX}>
                  {quoteLoading ? <Spinner size={36} color={t.vermilion60} /> : <Text style={[styles.paysXText, { color: color.accent }]}>{quote ? formatMultiplier(quote.multiplierMilli) : "···"}</Text>}
                </View>
                {quote && !quoteLoading ? <Text style={[styles.paysSub, { color: color.inkMuted }]}>{ticket.combined(legs.length, formatProbPct(quote.combinedProbRaw, one))}</Text> : null}
              </View>

              {quote?.correlated ? (
                <View style={[styles.corr, { backgroundColor: t.corrBg, borderColor: t.corrBorder }]}>
                  <AlertCircle size={14} color={t.corrIcon} />
                  <Text style={[styles.corrText, { color: t.corrInk }]}>{ticket.correlated}</Text>
                </View>
              ) : null}

              <View style={[styles.solver, { backgroundColor: t.solverBg, borderColor: t.solverBorder }]}>
                <View style={[styles.modes, { borderColor: t.toggleBorder }]}>
                  {mode("fixStake", ticket.setStake)}
                  {mode("fixPayout", ticket.setPayout)}
                </View>

                {solveMode === "fixStake" ? (
                  <AmountField label={ticket.youPay} value={stakeInput} onChange={onStakeInput} symbol={symbol} hint={ticket.wallet(walletSpendableBase !== null ? money(walletSpendableBase) : "…", symbol)} />
                ) : (
                  <AmountField label={ticket.youWin} value={payoutInput} onChange={onPayoutInput} symbol={symbol} hint={ticket.ifLands} />
                )}

                <View style={styles.rows}>
                  <Row label={ticket.youPay} emphasize>
                    {quoteLoading ? "…" : quote ? `${stakeText} ${symbol}` : "···"}
                  </Row>
                  <Row label={ticket.youWin} accent>
                    {quoteLoading ? "…" : quote ? `${payoutText} ${symbol}` : "···"}
                  </Row>
                  <View style={styles.profit}>{quote ? <Text style={[styles.profitText, { color: color.inkDisabled }]}>{ticket.profit(money(quote.maxPayoutBase - quote.stakeBase), symbol)}</Text> : null}</View>
                </View>
              </View>

              {quote ? (
                <View style={styles.breakdown}>
                  {legs.map((leg, i) => {
                    const m = marketOf(leg);
                    const bps = quote.legProbBps[i];
                    return (
                      <View key={leg.key} style={styles.bdRow}>
                        <Text style={[styles.bdWhat, { color: color.inkMuted }]}>
                          <Text style={{ color: leg.side === "up" ? t.profit80 : t.loss80 }}>{leg.side === "up" ? "UP" : "DOWN"}</Text> {m?.openingPriceRaw != null ? formatLine(m.openingPriceRaw, m.asset) : "···"}
                          {m ? (
                            <Text style={{ color: t.bdWhen }}>
                              {" "}
                              · {m.asset} {formatCadence(m.intervalSec)} · <Countdown expirySec={m.expirySec} intervalSec={m.intervalSec} nowMs={nowMs} />
                            </Text>
                          ) : null}
                        </Text>
                        <Text style={[styles.bdProb, { color: color.inkSecondary }]}>{bps !== undefined ? formatBpsPct(bps) : "·"}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {quoteError ? (
                <Pressable onPress={onRetryQuote} accessibilityRole="button">
                  {({ pressed }) => (
                    <Text style={[styles.quoteErr, { color: pressed ? color.loss : t.loss90 }]}>
                      {thin ? ticket.thinBook(thinLeg + 1, contracts(thin.filledRaw), contracts(thin.depthRaw)) : diagnosisCopy(quoteError.kind).headline} · {ticket.retry}
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <PlaceButton step={step} quoted={quote !== null} quoteLoading={quoteLoading} quoteError={quoteError !== null} hasEnough={hasEnough} stakeText={stakeText} symbol={symbol} onPlace={onPlace} />

              <Text style={[styles.footnote, { color: color.inkDisabled }]}>
                {ticket.footnote}
                {"\n"}
                {reserve.paused ? ticket.reservePaused : ticket.reserve(money(reserve.liquidBase), symbol, utilizationPct(reserve.utilizationBps))}
              </Text>

              {step === "error" && errorTitle ? <ErrorBlock title={errorTitle} detail={errorDetail} onReset={onReset} /> : null}

              {step === "success" && txHash ? (
                <Rise>
                  <Pressable onPress={() => void Linking.openURL(txUrl(txHash))} accessibilityRole="link">
                    {({ pressed }) => <Text style={[styles.txlink, { color: pressed ? color.profit : t.mint60 }]}>{ticket.viewTx}</Text>}
                  </Pressable>
                </Rise>
              ) : null}
            </>
          )}
        </View>
      </View>

      {legs.length >= 2 ? (
        <View style={styles.trophy}>
          <View style={styles.trophyIcon}>
            <Trophy size={14} color={color.inkDisabled} />
          </View>
          <Text style={[styles.trophyText, { color: color.inkDisabled }]}>{ticket.trophy}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  title: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 21, letterSpacing: 0.35 },
  tag: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 1.62, textTransform: "uppercase" },
  body: { padding: 20, gap: 16 },
  need2: { paddingVertical: 24, textAlign: "center", fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5 },
  pays: { alignItems: "center", paddingVertical: 8 },
  paysLabel: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 1.8, textTransform: "uppercase" },
  paysX: { flexDirection: "row", justifyContent: "center", minHeight: 48, alignItems: "center" },
  paysXText: { fontFamily: FONT.headingHeavy, fontSize: 48, lineHeight: 52, letterSpacing: -1.2 },
  paysSub: { marginTop: 8, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  corr: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  corrText: { flex: 1, fontFamily: FONT.body, fontSize: 11, lineHeight: 15.1 },
  solver: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  modes: { flexDirection: "row", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  mode: { flex: 1, paddingVertical: 6, alignItems: "center" },
  modeText: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 16.5 },
  rows: { gap: 6, paddingTop: 4 },
  profit: { flexDirection: "row", justifyContent: "flex-end", marginTop: -2, minHeight: 12 },
  profitText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  breakdown: { gap: 4 },
  bdRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 },
  bdWhat: { flexShrink: 1, fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5 },
  bdProb: { marginLeft: "auto", fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5 },
  quoteErr: { textAlign: "center", fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5, textDecorationLine: "underline" },
  footnote: { textAlign: "center", fontFamily: FONT.body, fontSize: 10, lineHeight: 16.25 },
  txlink: { textAlign: "center", fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5 },
  trophy: { marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  trophyIcon: { marginTop: 2 },
  trophyText: { flex: 1, fontFamily: FONT.body, fontSize: 10, lineHeight: 16.25 },
});
