import { isOk } from "@agari/core/schemas";
import { useRangeReserve } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { Hero, ReadingView, Screen, SectionHeader } from "~/components/kit";
import { GameHeaderActions, useGameScreen } from "~/features/games/shell";
import { refreshReserve } from "../range/RangeScreen";
import { HowCards, ReservePending } from "../range/ReserveParts";
import { RoundsList } from "../range/RoundsList";
import { MoonshotBuilder } from "./MoonshotBuilder";

/**
 * web's `moonshot/MoonshotScreen.tsx` (`/games/moonshot`): Pips' aim-and-fire call on the Range page's frame, over the
 * same live reserve — take aim, your rounds, how a moonshot pays. Without the reserve on this network the page says
 * what the mode is and what it waits on.
 */
export function MoonshotScreen() {
  const reading = useRangeReserve();
  const { boot } = useVenue();
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const { sections, notDeployed } = MOONSHOT;
  useGameScreen("moonshot");

  return (
    <Screen title={MOONSHOT.title} headerRight={() => <GameHeaderActions id="moonshot" />} onRefresh={() => refreshReserve(queryClient, address ?? null)}>
      <Hero kicker={MOONSHOT.eyebrow} title={`${MOONSHOT.title}.`} />
      <ReadingView reading={reading} loading="plate">
        {(reserve) =>
          reserve ? (
            <>
              <SectionHeader index={sections.aim.number} title={sections.aim.title} desc={sections.aim.desc} />
              <MoonshotBuilder reserve={reserve} symbol={symbol} />
              <SectionHeader index={sections.rounds.number} title={sections.rounds.title} desc={sections.rounds.desc} />
              <RoundsList kind="moonshot" empty={MOONSHOT.slip} symbol={symbol} decimals={reserve.decimals} staleAfterSec={reserve.params.staleAfterSec} />
              <HowCards number={sections.how.number} title={sections.how.title} cards={MOONSHOT.how} />
            </>
          ) : (
            <ReservePending title={notDeployed.title} body={notDeployed.body} why={notDeployed.why} dependency={notDeployed.dependency} />
          )
        }
      </ReadingView>
    </Screen>
  );
}
