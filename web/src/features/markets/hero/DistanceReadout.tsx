import { neededMove } from "@masayume/core/market";
import type { Side } from "@masayume/core/types";
import { HERO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { OraclePrice } from "./OraclePrice";

interface DistanceReadoutProps {
  openingRaw: bigint | null;
  currentRaw: bigint | null;
  /** The side the user is leaning toward reads at full ink; the other steps back. */
  side?: Side;
}

const SIDE_WORD: Record<Side, string> = { up: "UP", down: "DOWN" };

function SideLine({ side, needsRaw, emphasized }: { side: Side; needsRaw: bigint; emphasized: boolean }) {
  const word = SIDE_WORD[side];
  const signedRaw = side === "up" ? needsRaw : -needsRaw;
  return (
    <li className={cn("type-body", emphasized ? "text-ink" : "text-ink-secondary")}>
      {needsRaw === 0n ? (
        HERO.leading(word)
      ) : (
        <>
          {HERO.needs.before} <OraclePrice raw={signedRaw} signed /> {HERO.needs.after(word)}
        </>
      )}
    </li>
  );
}

/** What each side still needs, in dollars — pending phrasing until the print exists, never a guessed level. */
export function DistanceReadout({ openingRaw, currentRaw, side }: DistanceReadoutProps) {
  if (openingRaw === null) return <p className="type-caption text-ink-secondary">{HERO.pendingDistance}</p>;
  if (currentRaw === null) return <p className="type-caption text-ink-secondary">{HERO.noLivePrice}</p>;
  const move = neededMove(currentRaw, openingRaw);
  return (
    <ul className="flex flex-col gap-1">
      <SideLine side="up" needsRaw={move.upNeedsRaw} emphasized={side !== "down"} />
      <SideLine side="down" needsRaw={move.downNeedsRaw} emphasized={side !== "up"} />
    </ul>
  );
}
