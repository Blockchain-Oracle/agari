"use client";

import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { BalancePlate, BalancePlateView } from "@/features/markets/balance";
import { BALANCE } from "@/lib/copy";
import { BALANCE_FIXTURES, FIXTURE_SYMBOL } from "./fixtures";

/** Every plate state from canned sheets, then the live plate for whichever wallet is connected. */
export function BalanceFixtures() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-8 px-gutter py-8 lg:px-gutter-desktop">
      <SectionHeader index="01" title={BALANCE.devTitle} />
      <FixtureGrid>
        {BALANCE_FIXTURES.map(({ key, reading }) => (
          <Fixture key={key} label={BALANCE.fixtures[key]}>
            <BalancePlateView reading={reading} symbol={FIXTURE_SYMBOL} />
          </Fixture>
        ))}
      </FixtureGrid>

      <SectionHeader index="02" title={BALANCE.fixtures.live} />
      <div className="max-w-(--content-reading)">
        <BalancePlate />
      </div>
    </div>
  );
}
