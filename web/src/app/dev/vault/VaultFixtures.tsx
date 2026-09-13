"use client";

import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { TradingBalancePanel, TradingBalanceView, VAULT, VaultBetRow, VaultRow } from "@/features/vault";
import { FIXTURE_NOW_MS, FIXTURE_SYMBOL, OPEN_BETS, VAULT_FIXTURES, WALLET_SPENDABLE } from "./fixtures";

const noop = () => undefined;

/** Every Trading Balance state from canned readings through the real view, the pool row both ways, the open-bet rows, then the live panel. */
export function VaultFixtures() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-8 px-gutter py-8 lg:px-gutter-desktop">
      <SectionHeader index="01" title={VAULT.devTitle} />
      <FixtureGrid>
        {VAULT_FIXTURES.map(({ key, reading, busy }) => (
          <Fixture key={key} label={VAULT.fixtures[key]}>
            <TradingBalanceView
              reading={reading}
              symbol={FIXTURE_SYMBOL}
              walletSpendableBase={WALLET_SPENDABLE}
              needsApproval={key === "empty"}
              open={key === "grants" ? { count: 2, stakeBase: 19n * 10n ** 6n } : { count: 0, stakeBase: 0n }}
              poolCredit={[]}
              blocker={null}
              busy={busy}
              onDeposit={noop}
              onWithdraw={noop}
              onWithdrawPrivate={noop}
              onRevoke={noop}
              onSweep={noop}
              inline
            />
          </Fixture>
        ))}
      </FixtureGrid>

      <SectionHeader index="02" title={VAULT.row.label} />
      <FixtureGrid>
        <Fixture label={VAULT.fixtures.notDeployed}>
          <div role="list">
            <VaultRow value={null} decimals={6} symbol={FIXTURE_SYMBOL} panel={<p className="type-caption text-ink-muted">{VAULT.notDeployed.why}</p>} />
          </div>
        </Fixture>
        <Fixture label={VAULT.fixtures.funded}>
          <div role="list">
            <VaultRow value={240_500_000n} decimals={6} symbol={FIXTURE_SYMBOL} />
          </div>
        </Fixture>
      </FixtureGrid>

      <SectionHeader index="03" title={VAULT.fixtures.bets} />
      <ul className="flex flex-col">
        {OPEN_BETS.map((bet) => (
          <VaultBetRow key={bet.marketId} bet={bet} symbol={FIXTURE_SYMBOL} nowMs={FIXTURE_NOW_MS} />
        ))}
      </ul>

      <SectionHeader index="04" title={VAULT.fixtures.live} />
      <div className="max-w-(--content-reading)">
        <TradingBalancePanel />
      </div>
    </div>
  );
}
