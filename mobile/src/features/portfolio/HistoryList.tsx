import { formatCadence } from "@agari/core/copy";
import { roundSettledAtMs, type SettledRound } from "@agari/core/projection";
import { OUTCOME_TO_SIDE } from "@agari/core/types";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { timeAgo } from "@/features/markets/history/time-ago";
import type { HistoryReading } from "@/features/markets/history/useHistoryReading";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { VAULT } from "@/features/vault/copy";
import { Button, EmptyState, ReadingView } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { BetLine, type Figure } from "./BetLine";
import { CrankButton } from "./CrankButton";
import { money, pnlTone, signedMoney } from "./format";
import { HistoryReceipt } from "./HistoryReceipt";
import { Pager, usePage } from "./Pager";

const PAGE_SIZE = 8;
const NONE: readonly SettledRound[] = [];

function sidesLabel(round: SettledRound): string {
  const sides = round.legs.length > 0 ? round.legs.map((leg) => leg.outcomeIdx) : round.sidesTraded;
  return sides.map((idx) => SIDE_WORD[OUTCOME_TO_SIDE[idx]]).join(" + ");
}

/**
 * web `HistoryRows` + `HistoryRow`: every settled Window from the fill projection, eight a page — the outcome word, what
 * it paid, how long ago, the net result, and the receipt. A round still to collect links to its Window's claim; a vault
 * round offers the permissionless settle into the Trading Balance (web's crank, `CrankButton`).
 */
export function HistoryList({ history, symbol, nowMs }: { history: HistoryReading; symbol: string | undefined; nowMs: number }) {
  const { color } = useTheme();
  const [receipt, setReceipt] = useState<SettledRound | null>(null);
  const rounds = history.reading?.ok ? history.reading.value.rounds : NONE;
  const pager = usePage(rounds, PAGE_SIZE);

  return (
    <ReadingView reading={history.reading} loading="list" retry={history.retry}>
      {(value) =>
        value.rounds.length === 0 ? (
          <EmptyState why={HISTORY.empty.why} detail={HISTORY.empty.nextAction.label} />
        ) : (
          <View>
            {!value.complete ? <Text style={[TYPE.caption, { color: color.warning }]}>{HISTORY.partial}</Text> : null}
            {pager.slice.map((round) => {
              const isVault = round.source === "vault";
              const claimLine = round.paidByCrank ? HISTORY.paidAutomatically : HISTORY.claim[round.claim];
              const figures: Figure[] = [];
              if (round.payoutBase > 0n) figures.push({ label: HISTORY.paid, value: money(round.payoutBase, round.decimals, symbol) });
              figures.push({ label: HISTORY.net, value: signedMoney(round.pnlBase, round.decimals, symbol), tone: pnlTone(round.pnlBase) });
              const toCollect = round.claim === "to-collect";
              return (
                <BetLine
                  key={`${round.source}:${round.marketId}`}
                  status={HISTORY.outcome[round.outcome]}
                  asset={round.asset}
                  title={`${round.asset} ${sidesLabel(round)}`}
                  marketId={round.marketId}
                  meta={[formatCadence(round.intervalSec), isVault ? VAULT.rounds.via : null, nowMs > 0 ? timeAgo(roundSettledAtMs(round), nowMs) : null]}
                  figures={figures}
                  notes={[!toCollect && claimLine ? claimLine : null, round.shortCount > 0 ? HISTORY.shorted : null]}
                  action={
                    <>
                      {toCollect && isVault ? (
                        <CrankButton round={round} symbol={symbol} />
                      ) : null}
                      {toCollect && !isVault ? (
                        <Button label={`${claimLine} · ${HISTORY.collectLink}`} variant="ghost" size="sm" block={false} onPress={() => router.push({ pathname: "/markets/[id]", params: { id: round.marketId } })} />
                      ) : null}
                      <Button label={HISTORY.receipt} variant="outline" size="sm" block={false} icon={{ ios: "doc.text", android: "receipt_long" }} onPress={() => setReceipt(round)} />
                    </>
                  }
                />
              );
            })}
            <Pager pager={pager} size={PAGE_SIZE} />
            <HistoryReceipt round={receipt} symbol={symbol ?? ""} onClose={() => setReceipt(null)} />
          </View>
        )
      }
    </ReadingView>
  );
}
