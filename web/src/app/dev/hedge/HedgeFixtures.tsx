"use client";

import type { MarketId, Side } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/chrome";
import { EmptyState } from "@/components/states";
import { HEDGE, HedgeCard, hedgeStakeBase, LiveHedgeCard, type HedgePick } from "@/features/hedge";
import { useLanesState } from "@/features/markets/lanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { Fixture } from "../states/_sections/Fixture";
import { BALANCE_BASE, HEDGE_FIXTURES, NO_CARD } from "./fixtures";

const DECIMALS = 6;
const SYMBOL = "tUSDC";

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

  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="S6" title={HEDGE.dev.title} />
      <p className="type-body text-ink-secondary">{HEDGE.dev.intro}</p>
      <div className="markets-main flex flex-col">
        <Canned label={HEDGE.dev.gap} pick={HEDGE_FIXTURES.gap} onSelect={open} />
        <Canned label={HEDGE.dev.session} pick={HEDGE_FIXTURES.session} onSelect={open} />
        <Canned label={HEDGE.dev.token} pick={HEDGE_FIXTURES.token} onSelect={open} />
        <Canned label={HEDGE.dev.noPrice} pick={HEDGE_FIXTURES.noPrice} onSelect={open} />
        <Fixture label={HEDGE.dev.none}>
          <p className="type-caption text-ink-muted">
            empty → {String(NO_CARD.empty)} · SPYx with no Window → {String(NO_CARD.noWindow)}
          </p>
        </Fixture>
        <Fixture label={HEDGE.dev.live}>
          <LiveHedgeCard laneSet={lanes.laneSet} nowMs={nowMs} onSelect={open} />
          {address === null && <EmptyState why={HEDGE.dev.liveEmpty} />}
        </Fixture>
      </div>
    </div>
  );
}
