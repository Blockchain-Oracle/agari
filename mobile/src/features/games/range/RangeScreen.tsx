import { isOk } from "@agari/core/schemas";
import { keys, useRangeReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useVenue } from "@/features/markets/useVenue";
import { RANGE } from "@/features/range/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { GamesPage } from "~/features/games/frame";
import { useGameScreen } from "~/features/games/shell";
import { CapabilityPending, CpText, HowCards, PlBlock, PlHero, ReadingBoundary } from "./PageParts";
import { RangeBuilder } from "./RangeBuilder";
import { RoundsList } from "./RoundsList";

/** Pull to refresh: the reserve (and the quotes and capacity nested under it) and this wallet's rounds. */
export function useReserveRefresh() {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  return useCallback(
    () => Promise.all([queryClient.invalidateQueries({ queryKey: keys.rangeReserve() }), queryClient.invalidateQueries({ queryKey: keys.ranges(address ?? null) })]),
    [queryClient, address],
  );
}

/**
 * web's `range/RangeScreen.tsx` (`/games/range`) on the parlay page's frame: the hero, "Call a band" (the Window plate
 * and the ticket), your rounds, and how a range pays. Without the reserve on this network, web's CapabilityPending.
 */
export function RangeScreen() {
  const reading = useRangeReserve();
  const { boot } = useVenue();
  const refresh = useReserveRefresh();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const { sections, notDeployed } = RANGE;
  useGameScreen("range");

  return (
    <GamesPage onRefresh={refresh}>
      <ReadingBoundary reading={reading} shape="plate">
        {(reserve) =>
          reserve ? (
            <>
              <PlHero eyebrow={RANGE.eyebrow} title={RANGE.title} />
              <PlBlock number={sections.build.number} title={sections.build.title} desc={sections.build.desc}>
                <RangeBuilder reserve={reserve} symbol={symbol} />
              </PlBlock>
              <PlBlock number={sections.rounds.number} title={sections.rounds.title} desc={sections.rounds.desc}>
                <RoundsList kind="range" symbol={symbol} decimals={reserve.decimals} staleAfterSec={reserve.params.staleAfterSec} />
              </PlBlock>
              <PlBlock number={sections.how.number} title={sections.how.title}>
                <HowCards cards={RANGE.how} />
              </PlBlock>
            </>
          ) : (
            <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
              <CpText>{notDeployed.body}</CpText>
              <CpText>{notDeployed.why}</CpText>
            </CapabilityPending>
          )
        }
      </ReadingBoundary>
    </GamesPage>
  );
}
