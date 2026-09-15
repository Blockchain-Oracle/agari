"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { LeaderboardBoard, type BoardQuery } from "@/features/leaderboard";
import { FIXED_NOW_MS } from "../states/fixtures";
import { boardFor, EMPTY_SLICE, FAILED, NEXT_EXPIRY_SEC, PARTIAL_DAY, PREVIOUS_SESSION, YOU } from "./fixtures";

const DEV = {
  title: "Leaderboard",
  intro: "The board from canned slices — period and ticker tabs, today's and an earlier session, partial, empty, loading, failed. No indexer.",
  live: "Tabs — this session and the last 24 hours, the venue and each ticker; you are ranked #6",
  previous: "Before the open — the previous session, by its date",
  partial: "A capped scan on a failed refresh — partial day, last board kept",
  empty: "A ticker with no closed calls",
  loading: "Reading",
  failed: "Failed",
} as const;

const noop = () => undefined;

export default function DevLeaderboardPage() {
  const [board, setBoard] = useState<BoardQuery>({ period: "session", ticker: null });
  const sections = [
    { title: DEV.previous, node: <LeaderboardBoard reading={PREVIOUS_SESSION} address={null} nextExpirySec={null} nowMs={FIXED_NOW_MS} board={{ period: "session", ticker: null }} onBoard={noop} /> },
    { title: DEV.partial, node: <LeaderboardBoard reading={PARTIAL_DAY} address={null} nextExpirySec={NEXT_EXPIRY_SEC} nowMs={FIXED_NOW_MS} board={{ period: "24h", ticker: null }} onBoard={noop} /> },
    { title: DEV.empty, node: <LeaderboardBoard reading={EMPTY_SLICE} address={YOU} nextExpirySec={NEXT_EXPIRY_SEC} nowMs={FIXED_NOW_MS} board={{ period: "session", ticker: "MSFT" }} onBoard={noop} /> },
    { title: DEV.loading, node: <LeaderboardBoard reading={null} address={null} nextExpirySec={null} nowMs={FIXED_NOW_MS} board={{ period: "session", ticker: null }} onBoard={noop} /> },
    { title: DEV.failed, node: <LeaderboardBoard reading={FAILED} address={null} nextExpirySec={null} nowMs={FIXED_NOW_MS} board={{ period: "24h", ticker: null }} onBoard={noop} retry={noop} /> },
  ];
  return (
    <div className="flex w-full flex-col gap-10 py-8">
      <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-2 px-gutter">
        <SectionHeader index="00" title={DEV.title} />
        <p className="type-body text-ink-secondary">{DEV.intro}</p>
      </div>
      <section className="flex flex-col gap-4">
        <div className="mx-auto w-full max-w-(--content-wide) px-gutter">
          <SectionHeader index="01" title={DEV.live} />
        </div>
        <LeaderboardBoard reading={boardFor(board)} address={YOU} nextExpirySec={NEXT_EXPIRY_SEC} nowMs={FIXED_NOW_MS} board={board} onBoard={setBoard} />
      </section>
      {sections.map((section, i) => (
        <section key={section.title} className="flex flex-col gap-4">
          <div className="mx-auto w-full max-w-(--content-wide) px-gutter">
            <SectionHeader index={String(i + 2).padStart(2, "0")} title={section.title} />
          </div>
          {section.node}
        </section>
      ))}
    </div>
  );
}
