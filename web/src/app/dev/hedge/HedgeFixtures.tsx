"use client";

import type { MarketId, Side } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/chrome";
import { EmptyState } from "@/components/states";
import { EXAMPLE_HOLDINGS, exampleLaneSet, examplePick, HEDGE, HedgeCard, hedgeStakeBase, HedgeTeaser, HoldingReelCard, LiveHedgeCard, YourStocksList, type HedgePick } from "@/features/hedge";
import { useLanesState } from "@/features/markets/lanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { CLOCK } from "../session/market-session-fixtures";
import { Fixture } from "../states/_sections/Fixture";
import { BALANCE_BASE, BASKETS_FIXTURE, CALM_LEAD, HEDGE_FIXTURES, NO_CARD, STOCKS_FIXTURE } from "./fixtures";

const DECIMALS = 6;
const SYMBOL = "tUSDC";
const noop = () => {};

function Canned({ label, pick, onSelect }: { label: string; pick: HedgePick; onSelect: (marketId: MarketId, side?: Side) => void }) {
  const stakeBase = hedgeStakeBase({ exposureUsdE6: pick.exposureUsdE6, decimals: DECIMALS, ticketMaxBase: null, balanceBase: BALANCE_BASE });
  return (
    <Fixture label={label}>
      <HedgeCard pick={pick} stakeBase={stakeBase} decimals={DECIMALS} symbol={SYMBOL} onSelect={onSelect} />
    </Fixture>
  );
}

/** A fixture's tap opens `/markets` on its Window in-app, so the stake preset rides along (it lives in module state). */
export function HedgeFixtures() {
  const router = useRouter();
  const open = (marketId: MarketId, side?: Side) => router.push(marketDeepLink({ marketId, dir: side }));
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  const { address } = useWalletSession();
  const example = examplePick(Math.floor((nowMs || Date.now()) / 1000));

  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="S6" title={HEDGE.dev.title} />
      <p className="type-body text-ink-secondary">{HEDGE.dev.intro}</p>
      <div className="markets-main flex flex-col">
        <Canned label={HEDGE.dev.gap} pick={HEDGE_FIXTURES.gap} onSelect={open} />
        <Canned label={HEDGE.dev.session} pick={HEDGE_FIXTURES.session} onSelect={open} />
        <Canned label={HEDGE.dev.token} pick={HEDGE_FIXTURES.token} onSelect={open} />
        <Canned label={HEDGE.dev.noPrice} pick={HEDGE_FIXTURES.noPrice} onSelect={open} />
        <Canned label={HEDGE.dev.preIpo} pick={HEDGE_FIXTURES.preIpo} onSelect={open} />
        <Canned label={HEDGE.dev.basket} pick={HEDGE_FIXTURES.basket} onSelect={open} />
        <Fixture label={HEDGE.dev.none}>
          <p className="type-caption text-ink-muted">
            empty → {String(NO_CARD.empty)} · SPYx with no Window → {String(NO_CARD.noWindow)}
          </p>
        </Fixture>
        <Fixture label={HEDGE.dev.teasers}>
          <HedgeTeaser state={{ kind: "no-wallet" }} onExample={noop} />
          <HedgeTeaser state={{ kind: "reading" }} onExample={noop} />
          <HedgeTeaser state={{ kind: "unreadable" }} onExample={noop} />
          <HedgeTeaser state={{ kind: "no-holding" }} onExample={noop} />
          <HedgeTeaser state={{ kind: "no-window", lead: HEDGE_FIXTURES.preIpo.holdings[0]! }} onExample={noop} />
          <HedgeTeaser state={{ kind: "calm", lead: CALM_LEAD }} onExample={noop} />
        </Fixture>
        <Fixture label={HEDGE.dev.example}>
          {example && <HedgeCard pick={example} stakeBase={null} decimals={DECIMALS} symbol={SYMBOL} onSelect={noop} stamp={HEDGE.example.stamp} ctaText={HEDGE.example.hide} note={HEDGE.example.note} />}
        </Fixture>
        <Fixture label={HEDGE.dev.stocks}>
          <YourStocksList holdings={EXAMPLE_HOLDINGS} laneSet={exampleLaneSet(Math.floor((nowMs || Date.now()) / 1000))} nowMs={nowMs || Date.now()} index="01" />
        </Fixture>
        <Fixture label={HEDGE.dev.baskets}>
          <YourStocksList holdings={BASKETS_FIXTURE.both.holdings} laneSet={BASKETS_FIXTURE.both.laneSet} nowMs={CLOCK.weekendSat * 1000} index="03" />
          <YourStocksList holdings={BASKETS_FIXTURE.one.holdings} laneSet={BASKETS_FIXTURE.one.laneSet} nowMs={CLOCK.weekendSat * 1000} index="04" />
        </Fixture>
        <Fixture label={HEDGE.dev.calm}>
          <YourStocksList holdings={STOCKS_FIXTURE.holdings} laneSet={STOCKS_FIXTURE.laneSet} nowMs={CLOCK.weekendSat * 1000} index="02" movement={STOCKS_FIXTURE.movement} />
        </Fixture>
        <Fixture label={HEDGE.dev.reel}>
          {example && (
            <div className="reel-page" style={{ height: "auto", overflow: "visible" }}>
              <div className="feed-card reel-slot" style={{ height: "auto" }}>
                <HoldingReelCard pick={example} />
              </div>
            </div>
          )}
        </Fixture>
        <Fixture label={HEDGE.dev.live}>
          <LiveHedgeCard laneSet={lanes.laneSet} nowMs={nowMs} onSelect={open} />
          {address === null && <EmptyState why={HEDGE.dev.liveEmpty} />}
        </Fixture>
      </div>
    </div>
  );
}
