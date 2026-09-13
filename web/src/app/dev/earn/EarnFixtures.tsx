"use client";

import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { EARN, PositionCard, SupplyCard, VaultPanel, WindowsTable } from "@/features/earn";
import "@/features/parlay/parlay-page.css";
import "@/features/earn/earn-page.css";
import { FIXTURE_NOW_MS, FIXTURE_SYMBOL, HISTORY, MARKETS, OPEN, VAULT } from "./fixtures";

const noop = () => undefined;
const UNIT = 10n ** 6n;

/** `/dev/earn` — the panel, the cards and the Windows table on canned readings. Scaffolding: never linked from the app. */
export function EarnFixtures() {
  return (
    <div className="container pl-page earn-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={EARN.devTitle} />
      <p className="type-caption text-ink-muted">
        Canned readings only. The live page is <Link href="/earn">/earn</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="Panel — live, above par">
          <VaultPanel vault={VAULT} symbol={FIXTURE_SYMBOL} />
        </Fixture>
        <Fixture label="Panel — below par, no maker key">
          <VaultPanel vault={{ ...VAULT, maker: null, sharePriceRaw: 998_700n }} symbol={FIXTURE_SYMBOL} />
        </Fixture>
        <Fixture label="Panel — paused">
          <VaultPanel vault={{ ...VAULT, paused: true }} symbol={FIXTURE_SYMBOL} />
        </Fixture>
        <Fixture label="Panel — loading">
          <VaultPanel vault={null} symbol={FIXTURE_SYMBOL} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Supply — disconnected">
          <SupplyCard connected={false} vault={VAULT} symbol={FIXTURE_SYMBOL} walletBase={null} busy={null} onSupply={noop} onMessage={noop} />
        </Fixture>
        <Fixture label="Supply — 4.90 in the wallet (quick amounts scale)">
          <SupplyCard connected vault={VAULT} symbol={FIXTURE_SYMBOL} walletBase={4_900_000n} busy={null} onSupply={noop} onMessage={noop} />
        </Fixture>
        <Fixture label="Supply — paused">
          <SupplyCard connected vault={{ ...VAULT, paused: true }} symbol={FIXTURE_SYMBOL} walletBase={240n * UNIT} busy={null} onSupply={noop} onMessage={noop} />
        </Fixture>
        <Fixture label="Position — nothing yet">
          <PositionCard connected vault={VAULT} symbol={FIXTURE_SYMBOL} shares={0n} worthBase={0n} unsettledExpired={false} busy={null} onWithdraw={noop} />
        </Fixture>
        <Fixture label="Position — all idle">
          <PositionCard connected vault={VAULT} symbol={FIXTURE_SYMBOL} shares={500n * UNIT} worthBase={500_022_000n} unsettledExpired={false} busy={null} onWithdraw={noop} />
        </Fixture>
        <Fixture label="Position — part deployed, a Window to settle">
          <PositionCard connected vault={{ ...VAULT, liquidBase: 300n * UNIT }} symbol={FIXTURE_SYMBOL} shares={500n * UNIT} worthBase={500_022_000n} unsettledExpired busy={null} onWithdraw={noop} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Windows — open and recent">
          <WindowsTable open={OPEN} history={HISTORY} markets={MARKETS} decimals={6} symbol={FIXTURE_SYMBOL} nowMs={FIXTURE_NOW_MS} busy={null} canSign onMerge={noop} onSettle={noop} />
        </Fixture>
        <Fixture label="Windows — none">
          <WindowsTable open={[]} history={[]} markets={new Map()} decimals={6} symbol={FIXTURE_SYMBOL} nowMs={FIXTURE_NOW_MS} busy={null} canSign={false} onMerge={noop} onSettle={noop} />
        </Fixture>
      </FixtureGrid>
    </div>
  );
}
