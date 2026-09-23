import { useCallback } from "react";
import { Text } from "react-native";
import { RANGE } from "@/features/range/copy";
import { useRangeRounds, type RangeRoundView } from "@/features/range/useRangeRounds";
import { useRangeWrites } from "@/features/range/useRangeWrites";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useWalletSession } from "@/lib/wallet-session";
import { EmptyState, ReadingView } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { RoundCard } from "./RoundCard";

interface Props {
  symbol: string;
  decimals: number;
  staleAfterSec: number;
  /** Which rounds this page owns: the reserve holds both kinds, and each page shows its own. */
  kind: RangeRoundView["kind"]["kind"];
  /** The page's own words for an empty slip; the range's by default. */
  empty?: { connected: string; disconnected: string };
}

/**
 * web's `range/RangeSlip.tsx`: the connected wallet's rounds of one kind, live first; the crank, the stale void and
 * the claim are on each card, through web's `useRangeWrites`. Shared by Range and Moonshot.
 */
export function RoundsList({ symbol, decimals, staleAfterSec, kind, empty }: Props) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const reading = useRangeRounds(address);
  const nowMs = useChainNowMs();
  const writes = useRangeWrites();
  const words = empty ?? { connected: RANGE.slip.emptyConnected, disconnected: RANGE.slip.emptyDisconnected };

  const onClaim = useCallback((round: RangeRoundView) => void writes.claim(round.roundId, round.maxPayoutBase, decimals, symbol), [writes, decimals, symbol]);
  const onSettle = useCallback((round: RangeRoundView) => void writes.settle(round.roundId, round.marketId), [writes]);
  const onVoidStale = useCallback((round: RangeRoundView) => void writes.voidStale(round.roundId), [writes]);

  if (!address) return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.disconnected}</Text>;

  return (
    <ReadingView reading={reading} loading="list">
      {(all) => {
        const rounds = all.filter((round) => round.kind.kind === kind);
        if (rounds.length === 0) return <EmptyState why={words.connected} />;
        return rounds.map((round) => (
          <RoundCard
            key={round.roundId.toString()}
            round={round}
            nowMs={nowMs}
            symbol={symbol}
            decimals={decimals}
            staleAfterSec={staleAfterSec}
            busy={writes.busy}
            onClaim={onClaim}
            onSettle={onSettle}
            onVoidStale={onVoidStale}
          />
        ));
      }}
    </ReadingView>
  );
}
