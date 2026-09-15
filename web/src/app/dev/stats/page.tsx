"use client";

import { oneUnit } from "@agari/core/units";
import { diagnosis, err, ok, type Reading } from "@agari/core";
import { SectionHeader } from "@/components/chrome";
import { StatsView, type TractionData } from "@/features/stats";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";
import { DECIMALS, FIXED_NOW_MS, SYMBOL } from "../states/fixtures";

const DEV = {
  title: "Traction",
  intro: "`/stats` from canned tape reads — a session's growth, a partial scan, no calls yet, reading and failed. No indexer.",
  full: "A session of calls",
  partial: "A capped scan (every figure a floor) with unattributed fills",
  none: "No calls yet",
  reading: "Reading",
  failed: "Failed",
} as const;

const ONE = oneUnit(DECIMALS);
const HOUR_MS = 3_600_000;
const START_MS = FIXED_NOW_MS - 24 * HOUR_MS;
const ASSETS = ["TSLA", "NVDA", "AAPL", "QQQ"] as const;

const meta = (complete: boolean) => ({ period: "24h" as const, windowStartMs: START_MS, windowEndMs: FIXED_NOW_MS, computedAtMs: FIXED_NOW_MS - 42_000, complete, decimals: DECIMALS, symbol: SYMBOL });

function traction(wallets: number, calls: number, complete: boolean, unattributed: number): TractionData {
  const recent = Array.from({ length: Math.min(calls, 12) }, (_, i) => {
    const cashOut = i % 5 === 4;
    return {
      id: `${i}`,
      wallet: fixtureAddress(0x7100 + (i % wallets)),
      kind: cashOut ? ("cash-out" as const) : ("call" as const),
      side: i % 2 === 0 ? ("up" as const) : ("down" as const),
      asset: ASSETS[i % ASSETS.length]!,
      marketId: fixtureMarketId(0x9000 + i),
      stakeBase: cashOut ? 0n : BigInt(1 + (i % 3)) * ONE,
      txHash: fixtureSignature(0xabc000 + i),
      atMs: FIXED_NOW_MS - (i * 7 + 1) * 60_000,
    };
  });
  const hours = 7;
  const curve = Array.from({ length: hours }, (_, h) => ({ atMs: FIXED_NOW_MS - (hours - 1 - h) * HOUR_MS, cumulative: Math.round((wallets * (h + 1) ** 2) / hours ** 2) }));
  return { wallets, calls, cashOuts: Math.floor(calls / 5), stakedBase: BigInt(calls * 2) * ONE, unattributed, windows: 337, settledWindows: 331, curve: calls > 0 ? curve : [], recent, meta: meta(complete) };
}

const READINGS: { title: string; reading: Reading<TractionData> | null }[] = [
  { title: DEV.full, reading: ok(traction(3, 72, true, 0), FIXED_NOW_MS) },
  { title: DEV.partial, reading: ok(traction(41, 1_280, false, 2), FIXED_NOW_MS) },
  { title: DEV.none, reading: ok(traction(0, 0, true, 0), FIXED_NOW_MS) },
  { title: DEV.reading, reading: null },
  { title: DEV.failed, reading: err(diagnosis("indexer-down", "traction route answered 503")) },
];

export default function DevStatsPage() {
  return (
    <div className="flex w-full flex-col gap-10 py-8">
      <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-2 px-gutter">
        <SectionHeader index="00" title={DEV.title} />
        <p className="type-body text-ink-secondary">{DEV.intro}</p>
      </div>
      {READINGS.map((entry, i) => (
        <section key={entry.title} className="flex flex-col gap-4">
          <div className="mx-auto w-full max-w-(--content-wide) px-gutter">
            <SectionHeader index={String(i + 1).padStart(2, "0")} title={entry.title} />
          </div>
          <StatsView reading={entry.reading} nowMs={FIXED_NOW_MS} />
        </section>
      ))}
    </div>
  );
}
