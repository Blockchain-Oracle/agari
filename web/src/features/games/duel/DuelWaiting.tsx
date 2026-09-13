"use client";

import { STT_FAUCETS } from "@masayume/core/constants";
import type { Address, Diagnosis } from "@masayume/core/types";
import { useNowMs } from "@/components/data";
import { shortHex } from "@masayume/core/units";
import { DUEL } from "./copy";
import type { DealingView } from "./useDuelRoom";

/**
 * The two things a duel used to do silently: wait, and refuse.
 *
 * A spinner labelled "sealing the deck…" looked identical at one second and at ninety, and the room knew
 * the difference the whole time — it logs "the next deck is dealable in 47s" while the screen says
 * nothing. And a transaction refused before the wallet was ever asked put the button back where it was
 * with no word at all, which is what a wallet holding no STT experienced end to end.
 *
 * Both are drawn from facts, never from a guess. The countdown runs off the room's own `serverTimeMs`
 * plus elapsed local time rather than off a browser clock that may be minutes out, and a refusal shows
 * the diagnosis the write lane produced rather than a rewritten one.
 */

/** Seconds left on a server deadline, measured from when this browser received it. */
function leftSec(dealing: DealingView, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - dealing.atMs);
  return Math.max(0, Math.round((dealing.givesUpAtMs - dealing.serverTimeMs - elapsed) / 1_000));
}

export function DealingPlate({ dealing }: { dealing: DealingView }) {
  const nowMs = useNowMs();
  const bothSeedsIn = dealing.seedsIn >= 2;
  const deckLine =
    dealing.nextDeckInSec === undefined
      ? DUEL.lobby.deckUnknown
      : dealing.nextDeckInSec === null
        ? DUEL.lobby.deckNone
        : DUEL.lobby.deckIn(dealing.nextDeckInSec);

  return (
    <>
      <p className="du-deck" aria-live="polite">
        {bothSeedsIn ? deckLine : DUEL.lobby.seedWait(dealing.seedsIn)}
      </p>
      <p className="du-body">{bothSeedsIn ? DUEL.lobby.venueWait : DUEL.lobby.seedBody}</p>
      {nowMs > 0 && <p className="du-foot">{DUEL.lobby.givesUp(leftSec(dealing, nowMs))}</p>}
    </>
  );
}

/**
 * A refusal, with the one route out of it that exists.
 *
 * An empty gas tank is the only diagnosis with somewhere to send a player, so it is the only one that
 * gets links — the rest say what happened and offer the button again (FR-2's rule: route to a faucet,
 * never a raw revert).
 */
export function RefusalPlate({ diagnosis, gasShort, wallet }: { diagnosis: Diagnosis; gasShort: boolean; wallet: Address | null }) {
  return (
    <div className="du-refusal" role="status">
      <p className="du-body">{DUEL.lobby.refusedTitle}</p>
      <p className="du-foot">{diagnosis.technical}</p>
      {gasShort && (
        <>
          <p className="du-body">{DUEL.entry.gasShort}</p>
          {wallet && <p className="du-foot du-mono">{shortHex(wallet, 10, 6)}</p>}
          <ul className="du-faucets">
            {STT_FAUCETS.map((faucet) => (
              <li key={faucet.url}>
                <a href={faucet.url} target="_blank" rel="noreferrer">
                  {faucet.name} →
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
