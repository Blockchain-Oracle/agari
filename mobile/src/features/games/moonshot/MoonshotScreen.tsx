import { isOk } from "@agari/core/schemas";
import { useRangeReserve } from "@agari/markets/react";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { useVenue } from "@/features/markets/useVenue";
import { GamesPage } from "~/features/games/frame";
import { useGameScreen } from "~/features/games/shell";
import { CapabilityPending, CpText, HowCards, PlBlock, PlHero, ReadingBoundary } from "../range/PageParts";
import { useReserveRefresh } from "../range/RangeScreen";
import { RoundsList } from "../range/RoundsList";
import { MoonshotBuilder } from "./MoonshotBuilder";

/**
 * web's `moonshot/MoonshotScreen.tsx` (`/games/moonshot`): Pips' aim-and-fire call on the Range page's frame, over the
 * same live reserve — take aim, your rounds, how a moonshot pays. Without the reserve here, web's CapabilityPending.
 */
export function MoonshotScreen() {
  const reading = useRangeReserve();
  const { boot } = useVenue();
  const refresh = useReserveRefresh();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const { sections, notDeployed } = MOONSHOT;
  useGameScreen("moonshot");

  return (
    <GamesPage {...refresh}>
      <ReadingBoundary reading={reading} shape="plate">
        {(reserve) =>
          reserve ? (
            <>
              <PlHero eyebrow={MOONSHOT.eyebrow} title={MOONSHOT.title} />
              <PlBlock number={sections.aim.number} title={sections.aim.title} desc={sections.aim.desc}>
                <MoonshotBuilder reserve={reserve} symbol={symbol} />
              </PlBlock>
              <PlBlock number={sections.rounds.number} title={sections.rounds.title} desc={sections.rounds.desc}>
                <RoundsList kind="moonshot" empty={MOONSHOT.slip} symbol={symbol} decimals={reserve.decimals} staleAfterSec={reserve.params.staleAfterSec} />
              </PlBlock>
              <PlBlock number={sections.how.number} title={sections.how.title}>
                <HowCards cards={MOONSHOT.how} />
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
