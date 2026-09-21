"use client";

import { makerSheet } from "@agari/core/reserves";
import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { EARN, PositionCard, ReservePanel, RESERVES, SupplyCard, WindowsTable } from "@/features/earn";
import "@/features/parlay/parlay-page.css";
import "@/features/earn/earn-page.css";
import { FIXTURE_NOW_MS, FIXTURE_SYMBOL, HISTORY, MARKETS, OPEN, VAULT } from "./fixtures";
import { ReserveTabFixtures } from "./ReserveTabFixtures";

const noop = () => undefined;
const UNIT = 10n ** 6n;
const MAKER = RESERVES.maker;
const SHEET = makerSheet(VAULT);

/** `/dev/earn` — the panel, the cards, the Windows table and every reserve tab on canned readings. Scaffolding: never linked from the app. */
export function EarnFixtures() {
  return (
    <div className="container pl-page earn-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={EARN.devTitle} />
      <p className="type-caption text-ink-muted">
        Canned readings only. The live page is <Link href="/earn">/earn</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="Panel — live, above par">
          <ReservePanel sheet={SHEET} symbol={FIXTURE_SYMBOL} words={MAKER} />
        </Fixture>
        <Fixture label="Panel — below par, no maker key">
          <ReservePanel sheet={{ ...SHEET, sharePriceRaw: 998_700n }} symbol={FIXTURE_SYMBOL} words={MAKER} status={EARN.panel.noMaker} />
        </Fixture>
        <Fixture label="Panel — paused">
          <ReservePanel sheet={{ ...SHEET, paused: true }} symbol={FIXTURE_SYMBOL} words={MAKER} />
        </Fixture>
        <Fixture label="Panel — loading">
          <ReservePanel sheet={null} symbol={FIXTURE_SYMBOL} words={MAKER} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Supply — disconnected">
          <SupplyCard connected={false} sheet={SHEET} symbol={FIXTURE_SYMBOL} walletBase={null} busy={null} onSupply={noop} onMessage={noop} />
        </Fixture>
        <Fixture label="Supply — 4.90 in the wallet (quick amounts scale)">
          <SupplyCard connected sheet={SHEET} symbol={FIXTURE_SYMBOL} walletBase={4_900_000n} busy={null} onSupply={noop} onMessage={noop} />
        </Fixture>
        <Fixture label="Supply — paused">
          <SupplyCard connected sheet={{ ...SHEET, paused: true }} symbol={FIXTURE_SYMBOL} walletBase={240n * UNIT} busy={null} onSupply={noop} onMessage={noop} />
        </Fixture>
        <Fixture label="Position — nothing yet">
          <PositionCard connected sheet={SHEET} words={MAKER} symbol={FIXTURE_SYMBOL} shares={0n} worthBase={0n} suppliedBase={0n} withdrawnBase={0n} busy={null} onWithdraw={noop} />
        </Fixture>
        <Fixture label="Position — all idle">
          <PositionCard connected sheet={SHEET} words={MAKER} symbol={FIXTURE_SYMBOL} shares={500n * UNIT} worthBase={500_022_000n} suppliedBase={500n * UNIT} withdrawnBase={0n} busy={null} onWithdraw={noop} />
        </Fixture>
        <Fixture label="Position — part deployed, a Window to settle">
          <PositionCard connected sheet={{ ...SHEET, liquidBase: 300n * UNIT }} words={MAKER} symbol={FIXTURE_SYMBOL} shares={500n * UNIT} worthBase={500_022_000n} suppliedBase={520n * UNIT} withdrawnBase={40n * UNIT} unsettledExpired busy={null} onWithdraw={noop} />
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
      <ReserveTabFixtures />
    </div>
  );
}
