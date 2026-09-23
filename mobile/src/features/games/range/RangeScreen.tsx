import { isOk } from "@agari/core/schemas";
import { keys, useRangeReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVenue } from "@/features/markets/useVenue";
import { RANGE } from "@/features/range/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Hero, ReadingView, Screen, SectionHeader } from "~/components/kit";
import { GameHeaderActions, useGameScreen } from "~/features/games/shell";
import { HowCards, ReservePending } from "./ReserveParts";
import { RangeBuilder } from "./RangeBuilder";
import { RoundsList } from "./RoundsList";

/** Pull to refresh: the reserve (and the quotes and capacity nested under it) and this wallet's rounds. */
export function refreshReserve(queryClient: ReturnType<typeof useQueryClient>, wallet: string | null) {
  return Promise.all([queryClient.invalidateQueries({ queryKey: keys.rangeReserve() }), queryClient.invalidateQueries({ queryKey: keys.ranges(wallet) })]);
}

/**
 * web's `range/RangeScreen.tsx` (`/games/range`): call a band on a live Window — inside or outside — priced by the
 * range reserve; your rounds with their crank, claim and verdict; how a range pays. When the reserve is not on this
 * network the page says what the mode is and what it waits on.
 */
export function RangeScreen() {
  const reading = useRangeReserve();
  const { boot } = useVenue();
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const { sections, notDeployed } = RANGE;
  useGameScreen("range");

  return (
    <Screen title={RANGE.title} headerRight={() => <GameHeaderActions id="range" />} onRefresh={() => refreshReserve(queryClient, address ?? null)}>
      <Hero kicker={RANGE.eyebrow} title={`${RANGE.title}.`} />
      <ReadingView reading={reading} loading="plate">
        {(reserve) =>
          reserve ? (
            <>
              <SectionHeader index={sections.build.number} title={sections.build.title} desc={sections.build.desc} />
              <RangeBuilder reserve={reserve} symbol={symbol} />
              <SectionHeader index={sections.rounds.number} title={sections.rounds.title} desc={sections.rounds.desc} />
              <RoundsList kind="range" symbol={symbol} decimals={reserve.decimals} staleAfterSec={reserve.params.staleAfterSec} />
              <HowCards number={sections.how.number} title={sections.how.title} cards={RANGE.how} />
            </>
          ) : (
            <ReservePending title={notDeployed.title} body={notDeployed.body} why={notDeployed.why} dependency={notDeployed.dependency} />
          )
        }
      </ReadingView>
    </Screen>
  );
}
