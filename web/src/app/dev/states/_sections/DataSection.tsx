import { SectionHeader } from "@/components/chrome";
import { Countdown, CountdownRing, Hash, Money, Odds, UtcTime } from "@/components/data";
import { CADENCE_SEC, DECIMALS, FIXED_NOW_MS, FIXED_NOW_SEC, SYMBOL, TX_HASH, TX_URL, WALLET } from "../fixtures";
import { Fixture, FixtureGrid } from "./Fixture";

const LIVE_EXPIRY_SEC = Math.floor(Date.now() / 1000) + 95;
const ODDS_SAMPLES = [50, 6200, 9900, 12_000, -400];

export function DataSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="03" title="Numbers" eyebrow="Plex Mono, tabular, always" />
      <FixtureGrid>
        <Fixture label="Money — neutral vs the only green/rose (P&L)">
          <div className="flex flex-col gap-1 type-data-lg text-ink">
            <Money value={1_204_500_000n} decimals={DECIMALS} symbol={SYMBOL} />
            <Money value={12_400_000n} decimals={DECIMALS} symbol={SYMBOL} tone="pnl" />
            <Money value={-8_150_000n} decimals={DECIMALS} symbol={SYMBOL} tone="pnl" />
            <Money value={0n} decimals={DECIMALS} symbol={SYMBOL} tone="pnl" />
            <Money value={5_000_000n} decimals={DECIMALS} symbol={SYMBOL} className="type-data-hero" />
          </div>
        </Fixture>
        <Fixture label="Odds — cents per dollar, clamped to [1, 99]">
          <div className="flex flex-wrap gap-4 type-data-lg text-ink">
            {ODDS_SAMPLES.map((bps) => (
              <Odds key={bps} bps={bps} />
            ))}
          </div>
        </Fixture>
        <Fixture label="Countdown — live (ticks, announces at 60 s and at settlement)">
          <Countdown expirySec={LIVE_EXPIRY_SEC} intervalSec={CADENCE_SEC} announce className="type-data-lg" />
        </Fixture>
        <Fixture label="Countdown — urgent (fixed clock, 42 s left of a 5m window)">
          <Countdown expirySec={FIXED_NOW_SEC + 42} intervalSec={CADENCE_SEC} nowMs={FIXED_NOW_MS} className="type-data-lg" />
        </Fixture>
        <Fixture label="Countdown — settling (never negative, never frozen)">
          <Countdown expirySec={FIXED_NOW_SEC - 5} intervalSec={CADENCE_SEC} nowMs={FIXED_NOW_MS} className="type-data-lg" />
        </Fixture>
        <Fixture label="Ring — hero urgent (the one glow) vs calm">
          <div className="flex items-center gap-6">
            <CountdownRing fraction={42 / CADENCE_SEC} urgent glow className="size-24">
              <Countdown expirySec={FIXED_NOW_SEC + 42} intervalSec={CADENCE_SEC} nowMs={FIXED_NOW_MS} className="type-data-lg" />
            </CountdownRing>
            <CountdownRing fraction={0.72} className="size-24">
              <Countdown expirySec={FIXED_NOW_SEC + 216} intervalSec={CADENCE_SEC} nowMs={FIXED_NOW_MS} className="type-data-lg" />
            </CountdownRing>
          </div>
        </Fixture>
        <Fixture label="Hash + UTC time">
          <div className="flex flex-col gap-1 type-data text-ink">
            <Hash value={TX_HASH} href={TX_URL} />
            <Hash value={WALLET} />
            <UtcTime ms={FIXED_NOW_MS} withDate />
            <UtcTime ms={FIXED_NOW_MS} withSeconds={false} />
          </div>
        </Fixture>
      </FixtureGrid>
    </section>
  );
}
