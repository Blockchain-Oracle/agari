"use client";

import type { PrivateTicket } from "@masayume/core/private";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { PRIVATE, PrivateBalancePanel, PrivateClaims } from "@/features/private";
import { usePrivateTickets } from "@/features/private/claims-store";
import { RouteControl } from "@/features/session";
import { CHAIN_ID, CONTRACT, FIXTURE_DESK, FIXTURE_SYMBOL, OWNER, signedTickets } from "./fixtures";

const noop = () => undefined;
const ROUTE = { onChange: noop, vaultAvailableBase: 12_000_000n, decimals: 6, symbol: FIXTURE_SYMBOL, armed: false, deployed: true } as const;

/** `/dev/private` — the route control's private states and the claims list on real signatures, then the live panel. Scaffolding: never linked from the app. */
export function PrivateFixtures() {
  const [tickets, setTickets] = useState<PrivateTicket[] | null>(null);
  const restored = usePrivateTickets(OWNER);
  useEffect(() => {
    void signedTickets().then(setTickets);
  }, []);
  const claims = { pinnedDesk: FIXTURE_DESK, contract: CONTRACT, chainId: CHAIN_ID, owner: OWNER, decimals: 6, symbol: FIXTURE_SYMBOL, onCashOut: noop, busySlot: null } as const;

  return (
    <div className="container pl-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={PRIVATE.devTitle} />
      <p className="type-caption text-ink-muted">
        Canned readings; the claims below carry real signatures from a throwaway key. The live control is on <Link href="/markets">/markets</Link>, the panel on <Link href="/portfolio">/portfolio</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="Route control — Private ready, chosen">
          <RouteControl {...ROUTE} source="private" privateOption={{ label: PRIVATE.route.label, enabled: true, title: PRIVATE.route.titleReady, retry: null, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
        <Fixture label="Route control — checking private mode">
          <RouteControl {...ROUTE} source="wallet" privateOption={{ label: PRIVATE.route.label, enabled: false, title: PRIVATE.route.titleProbing, retry: null, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
        <Fixture label="Route control — not available, with retry">
          <RouteControl {...ROUTE} source="wallet" privateOption={{ label: PRIVATE.route.label, enabled: false, title: PRIVATE.route.titleUnavailable("no desk key is configured on this deployment"), retry: noop, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
        <Fixture label="Route control — over the private cap">
          <RouteControl {...ROUTE} source="wallet" privateOption={{ label: PRIVATE.route.label, enabled: false, title: PRIVATE.route.titleOverCap(`25 ${FIXTURE_SYMBOL}`), retry: null, retryLabel: PRIVATE.route.retry }} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Claims — open (verified), restored and edited (unverified), won, lost">
          {tickets ? <PrivateClaims {...claims} claims={tickets} /> : <p className="type-caption text-ink-muted">signing…</p>}
        </Fixture>
        <Fixture label="Claims — restore into this browser">
          <PrivateClaims {...claims} claims={restored.tickets} onChanged={restored.refresh} />
        </Fixture>
        <Fixture label="Claims — cashing out the first">
          {tickets ? <PrivateClaims {...claims} claims={tickets.slice(0, 1)} busySlot={tickets[0]?.claim.slotId ?? null} /> : null}
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Live — the connected wallet's private balance and claims">
          <PrivateBalancePanel />
        </Fixture>
      </FixtureGrid>
    </div>
  );
}
