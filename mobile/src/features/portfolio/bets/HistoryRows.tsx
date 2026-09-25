import { formatCadence } from "@agari/core/copy";
import { roundSettledAtMs, type SettledRound, type WalletHistory } from "@agari/core/projection";
import { OUTCOME_TO_SIDE } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { timeAgo } from "@/features/markets/history/time-ago";
import type { HistoryReading } from "@/features/markets/history/useHistoryReading";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { VAULT } from "@/features/vault/copy";
import { useVaultWrite } from "@/features/vault/useVaultWrite";
import { usePager } from "@/lib/use-pager";
import { Pager, ReadingBoundary, usePortfolioTokens } from "~/components/portfolio/web";
import { openExternal } from "~/lib/external";
import { marketsEnv } from "~/lib/env";
import { useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { HistoryReceipt } from "../HistoryReceipt";
import { BetsRow, Break, Call, Caption, Micro, MoneyText } from "./RowParts";

const PAGE_SIZE = 8;
const NONE: readonly SettledRound[] = [];
const isEmpty = (value: WalletHistory) => value.rounds.length === 0;

function sidesLabel(round: SettledRound): string {
  const sides = round.legs.length > 0 ? round.legs.map((leg) => leg.outcomeIdx) : round.sidesTraded;
  return sides.map((idx) => SIDE_WORD[OUTCOME_TO_SIDE[idx]]).join(" + ");
}

interface RowProps {
  round: SettledRound;
  symbol: string | undefined;
  nowMs: number;
  first: boolean;
  onReceipt: (round: SettledRound) => void;
  onCrank: (round: SettledRound) => void;
  cranking: boolean;
}

/** web `HistoryRow`: the outcome word, what it paid, how long ago, the net in pnl ink, the receipt and the proof link. */
function HistoryRow({ round, symbol, nowMs, first, onReceipt, onCrank, cranking }: RowProps) {
  const { color } = useTheme();
  const t = usePortfolioTokens();
  const claimLine = round.paidByCrank ? HISTORY.paidAutomatically : HISTORY.claim[round.claim];
  const vault = round.source === "vault";
  const micro = (label: string, onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={6}>
      <Text style={[WEB_TYPE.labelMicro, { color: color.accent }, disabled && styles.off]}>{label}</Text>
    </Pressable>
  );
  return (
    <BetsRow first={first}>
      <Text style={[WEB_TYPE.labelMicro, { color: round.outcome === "win" ? color.ink : color.inkSecondary }]}>{HISTORY.outcome[round.outcome]}</Text>
      <Call marketId={round.marketId} asset={round.asset} text={`${round.asset} ${sidesLabel(round)}`} />
      <Micro>{formatCadence(round.intervalSec)}</Micro>
      {vault ? <Micro tone="accent">{VAULT.rounds.via}</Micro> : null}
      {round.payoutBase > 0n ? (
        <Caption>
          {HISTORY.paid} <MoneyText value={round.payoutBase} decimals={round.decimals} symbol={symbol} />
        </Caption>
      ) : null}
      {round.claim === "to-collect" && vault
        ? micro(cranking ? VAULT.rounds.cranking : VAULT.rounds.crank, () => onCrank(round), cranking)
        : round.claim === "to-collect"
          ? micro(`${claimLine} · ${HISTORY.collectLink}`, () => router.push({ pathname: "/markets/[id]", params: { id: round.marketId } }))
          : claimLine
            ? <Micro>{claimLine}</Micro>
            : null}
      {round.shortCount > 0 ? <Caption tone="muted">{HISTORY.shorted}</Caption> : null}
      <Break />
      {nowMs > 0 ? (
        <Caption tone="muted">
          <Text style={WEB_TYPE.numbers}>{timeAgo(roundSettledAtMs(round), nowMs)}</Text>
        </Caption>
      ) : null}
      <MoneyText value={round.pnlBase} decimals={round.decimals} pnl big />
      <Pressable onPress={() => onReceipt(round)} accessibilityRole="button" hitSlop={6}>
        <Text style={[WEB_TYPE.labelMicro, styles.receipt, { color: t.receiptInk }]}>{HISTORY.receipt} ↗</Text>
      </Pressable>
      {!vault ? (
        <Pressable onPress={() => void openExternal(txUrl(round.entryTxHash, marketsEnv.cluster))} accessibilityRole="link" accessibilityLabel={HISTORY.entryTx} hitSlop={8}>
          <Text style={[styles.proof, { color: t.vermilion }]}>↗</Text>
        </Pressable>
      ) : null}
    </BetsRow>
  );
}

/** web `HistoryRows`: settled Windows eight a page; a capped history says so above the rows rather than trimming quietly. */
export function HistoryRows({ history, symbol }: { history: HistoryReading; symbol: string | undefined }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const [receiptFor, setReceiptFor] = useState<SettledRound | null>(null);
  const { state: vaultWrite, run: runVault, address } = useVaultWrite();
  const rounds = history.reading?.ok ? history.reading.value.rounds : NONE;
  const pager = usePager(rounds, PAGE_SIZE);
  const crank = (round: SettledRound) => {
    if (address) void runVault({ kind: "vault-crank-settle", owner: address, marketId: round.marketId }, VAULT.rounds.cranked);
  };
  const empty = { why: HISTORY.empty.why, nextAction: { label: HISTORY.empty.nextAction.label, onPress: () => router.navigate("/markets") } };
  return (
    <ReadingBoundary reading={history.reading} shape="row" retry={history.retry} isEmpty={isEmpty} empty={empty} style={styles.inset}>
      {(value) => (
        <View>
          {!value.complete ? <Text style={[WEB_TYPE.caption, styles.partial, { color: color.warning }]}>{HISTORY.partial}</Text> : null}
          {pager.slice.map((round, i) => (
            <HistoryRow
              key={`${round.source}:${round.marketId}`}
              round={round}
              symbol={symbol}
              nowMs={nowMs}
              first={i === 0}
              onReceipt={setReceiptFor}
              onCrank={crank}
              cranking={vaultWrite.busy === "vault-crank-settle"}
            />
          ))}
          <Pager pager={pager} />
          <HistoryReceipt round={receiptFor} symbol={symbol ?? ""} onClose={() => setReceiptFor(null)} />
        </View>
      )}
    </ReadingBoundary>
  );
}

const styles = StyleSheet.create({
  inset: { paddingVertical: 16, paddingHorizontal: 20 },
  partial: { paddingTop: 10, paddingHorizontal: 20 },
  off: { opacity: 0.5 },
  receipt: { letterSpacing: 1.54 },
  proof: { ...WEB_TYPE.numbers, fontSize: 11 },
});
