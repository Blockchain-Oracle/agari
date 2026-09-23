import { SOL_FAUCETS } from "@agari/core/constants";
import type { Address, Diagnosis } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { useNowMs } from "@/components/data/useNowMs";
import { DUEL } from "@/features/games/duel/copy";
import type { DealingView } from "@/features/games/duel/useDuelRoom";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { Button } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { openFunds } from "~/web-shims/credited";
import { Body, DeckLine, Foot, Quiet, Refusal } from "./parts";

/**
 * web's `DuelWaiting.tsx`: the two things a duel used to do silently — wait, and refuse. The countdown runs off the
 * room's own `serverTimeMs` plus elapsed local time; a refusal shows the write lane's own diagnosis.
 */

/** Seconds left on a server deadline, measured from when this phone received it. */
function leftSec(dealing: DealingView, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - dealing.atMs);
  return Math.max(0, Math.round((dealing.givesUpAtMs - dealing.serverTimeMs - elapsed) / 1_000));
}

export function DealingPlate({ dealing }: { dealing: DealingView }) {
  const nowMs = useNowMs();
  const session = useMarketSession();
  const closed = session !== null && !session.open;
  const bothSeedsIn = dealing.seedsIn >= 2;
  const deckLine =
    dealing.nextDeckInSec === undefined
      ? DUEL.lobby.deckUnknown
      : dealing.nextDeckInSec === null
        ? closed
          ? DUEL.queue.deckClosed(session?.label ?? "")
          : DUEL.lobby.deckNone
        : DUEL.lobby.deckIn(dealing.nextDeckInSec);
  return (
    <>
      <DeckLine>{bothSeedsIn ? deckLine : DUEL.lobby.seedWait(dealing.seedsIn)}</DeckLine>
      <Body>{bothSeedsIn ? (closed ? DUEL.queue.deckWhyClosed : DUEL.lobby.venueWait) : DUEL.lobby.seedBody}</Body>
      {nowMs > 0 ? <Foot>{DUEL.lobby.givesUp(leftSec(dealing, nowMs))}</Foot> : null}
    </>
  );
}

/** The route out of an empty SOL tank: the app's own funding sheet, then the public devnet faucets. */
export function GasRoutes({ onRecheck }: { onRecheck?: () => void }) {
  return (
    <>
      <Button label="Get test funds" size="sm" block={false} onPress={openFunds} icon={{ ios: "drop.fill", android: "water_drop" }} />
      {SOL_FAUCETS.map((faucet) => (
        <Quiet key={faucet.url} label={`${faucet.name} →`} onPress={() => void openExternal(faucet.url)} />
      ))}
      {onRecheck ? <Quiet label={DUEL.entry.gasRecheck} onPress={onRecheck} /> : null}
    </>
  );
}

/** A refusal, with the one route out that exists: only an empty gas tank gets somewhere to go. */
export function RefusalPlate({ diagnosis, gasShort, wallet }: { diagnosis: Diagnosis; gasShort: boolean; wallet: Address | null }) {
  return (
    <Refusal>
      <Body>{DUEL.lobby.refusedTitle}</Body>
      <Foot>{diagnosis.technical}</Foot>
      {gasShort ? (
        <>
          <Body>{DUEL.entry.gasShort}</Body>
          {wallet ? <Foot>{shortHex(wallet, 10, 6)}</Foot> : null}
          <GasRoutes />
        </>
      ) : null}
    </Refusal>
  );
}
