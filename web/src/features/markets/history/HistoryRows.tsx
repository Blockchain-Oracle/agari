"use client";

import type { SettledRound, WalletHistory } from "@masayume/core/projection";
import { useState } from "react";
import { Pager } from "@/components/chrome";
import { ReadingBoundary } from "@/components/states";
import { useVaultWrite, VAULT } from "@/features/vault";
import { usePager } from "@/lib/use-pager";
import { useChainNowMs } from "../useChainNow";
import { HISTORY } from "./copy";
import { HistoryReceipt } from "./HistoryReceipt";
import { HistoryRow } from "./HistoryRow";
import type { HistoryReading } from "./useHistoryReading";

/** The reference shows eight settled rows (`HISTORY_ROWS`); ours turns pages of the same size. */
const PAGE_SIZE = 8;
const NO_ROUNDS: readonly SettledRound[] = [];

interface HistoryRowsProps {
  history: HistoryReading;
  symbol: string | undefined;
}

const isEmpty = (value: WalletHistory) => value.rounds.length === 0;

/**
 * Settled Windows, the History tab's own list. Every row is a derived round, so the list can only be
 * as complete as the reading says it is — a capped history says so above the rows rather than
 * trimming quietly.
 */
export function HistoryRows({ history, symbol }: HistoryRowsProps) {
  const nowMs = useChainNowMs();
  const [receiptFor, setReceiptFor] = useState<SettledRound | null>(null);
  const { state: vaultWrite, run: runVault, address } = useVaultWrite();
  const rounds = history.reading?.ok ? history.reading.value.rounds : NO_ROUNDS;
  const pager = usePager(rounds, PAGE_SIZE);
  const crank = (round: SettledRound) => {
    if (address) void runVault({ kind: "vault-crank-settle", owner: address, marketId: round.marketId }, VAULT.rounds.cranked);
  };

  return (
    <ReadingBoundary reading={history.reading} shape="row" retry={history.retry} isEmpty={isEmpty} empty={HISTORY.empty}>
      {(value) => (
        <div className="bets-fill">
          {!value.complete && <p className="type-caption text-warning">{HISTORY.partial}</p>}
          <ul className="bets-list">
            {pager.slice.map((round) => (
              <HistoryRow
                key={`${round.source}:${round.marketId}`}
                round={round}
                symbol={symbol}
                nowMs={nowMs}
                onReceipt={setReceiptFor}
                onCrank={crank}
                cranking={vaultWrite.busy === "vault-crank-settle"}
              />
            ))}
          </ul>
          <Pager pager={pager} />
          <HistoryReceipt round={receiptFor} symbol={symbol ?? ""} onClose={() => setReceiptFor(null)} />
        </div>
      )}
    </ReadingBoundary>
  );
}
