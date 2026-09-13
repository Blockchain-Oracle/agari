"use client";

import { computeBadges, computeTraderEdge, reputationOf, type SettledRound, type WalletHistory } from "@masayume/core/projection";
import { ok } from "@masayume/core";
import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { EdgeReport, EdgeState } from "@/features/edge";
import { LeaderboardBoard } from "@/features/leaderboard";
import { HISTORY, HistoryReceipt, HistoryRow, HistorySummary, ReputationPanel, TraderEdgeLink } from "@/features/markets/history";
import { DECIMALS, FIXED_NOW_MS, FIXED_NOW_SEC, SYMBOL } from "../states/fixtures";
import { BOARD, FIXTURE_ADDRESS, ROUNDS } from "./fixtures";

const DEV = {
  title: "Fill projection",
  intro: "Every settled-history, record, Trader Edge and leaderboard state from canned rounds — no wallet, no indexer.",
  rows: "Settled rows — paid, to collect, loss, void, closed early, short, hedge",
  record: "Your record — summary strip, reputation, badges",
  edge: "Trader Edge — the report, then its empty state",
  board: "Leaderboard — podium, the field, you",
} as const;

const HISTORY_VALUE: WalletHistory = { rounds: ROUNDS, openCount: 2, fillCount: 14, complete: true, decimals: DECIMALS };
const EDGE = computeTraderEdge(ROUNDS, 2);
const DECIDED = EDGE.wins + EDGE.losses;
const REPUTATION = reputationOf(DECIDED, EDGE.wins, EDGE.currentWinStreak);
const BADGES = computeBadges({ fillCount: 14, currentWinStreak: EDGE.currentWinStreak, stakeBase: EDGE.stakeBase, decidedRounds: DECIDED, winRate: DECIDED ? EDGE.wins / DECIDED : 0, decimals: DECIMALS, lpSharesRaw: 0n });

export default function DevHistoryPage() {
  const [receiptFor, setReceiptFor] = useState<SettledRound | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-10 px-gutter py-8">
      <div className="flex flex-col gap-2">
        <SectionHeader index="00" title={DEV.title} />
        <p className="type-body text-ink-secondary">{DEV.intro}</p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={DEV.rows} aside={<span className="type-label-micro text-ink-muted">{HISTORY.settledCount(ROUNDS.length)}</span>} />
        <ul className="flex flex-col">
          {ROUNDS.map((round) => (
            <HistoryRow key={round.marketId} round={round} symbol={SYMBOL} nowMs={FIXED_NOW_MS} onReceipt={setReceiptFor} />
          ))}
        </ul>
        <HistoryReceipt round={receiptFor} symbol={SYMBOL} onClose={() => setReceiptFor(null)} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title={DEV.record} />
        <TraderEdgeLink />
        <HistorySummary history={HISTORY_VALUE} edge={EDGE} address={FIXTURE_ADDRESS} symbol={SYMBOL} />
        <ReputationPanel reputation={REPUTATION} badges={BADGES} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title={DEV.edge} />
        <div className="edge-page rounded-lg p-4">
          <EdgeReport history={HISTORY_VALUE} report={EDGE} symbol={SYMBOL} />
          <EdgeState eyebrow="No settled rounds yet" title="Your edge starts after the close." copy="2 open rounds are still waiting to settle." />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="04" title={DEV.board} />
        <LeaderboardBoard reading={BOARD} address={FIXTURE_ADDRESS} nextExpirySec={FIXED_NOW_SEC + 275} nowMs={FIXED_NOW_MS} />
        <LeaderboardBoard reading={ok({ rankings: [], meta: { ...BOARD.ok ? BOARD.value.meta : { period: "24h" as const, windowStartMs: 0, windowEndMs: 0, computedAtMs: 0, rankedTraders: 0, totalWallets: 0, closedCalls: 0, totalVolumeBase: 0n, complete: false, decimals: DECIMALS, symbol: SYMBOL }, rankedTraders: 0, closedCalls: 0, totalVolumeBase: 0n } }, FIXED_NOW_MS)} address={null} nextExpirySec={null} nowMs={FIXED_NOW_MS} />
      </section>
    </div>
  );
}
