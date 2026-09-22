import { ADVICE_COPY } from "@agari/core/copy";
import { isAddress } from "@agari/core/types";
import type { Metadata } from "next";
import { StrategiesScreen } from "@/features/strategies";

export const metadata: Metadata = { title: "Strategies" };

/**
 * The house runner's key is the server's to know; the studio names it when a creator picks "Let Agari run it".
 *
 * The check is `isAddress`, core's own. It was an Ethereum one carried over with the port — `/^0x[0-9a-fA-F]{40}$/`
 * plus a `toLowerCase()` — which no base58 Solana address can pass, and which would have destroyed one if it did
 * (addresses are case-sensitive, D-010). So "Let Agari run it" was disabled on every deployment, however the
 * variable was set, and the studio said a house runner was not configured while one was.
 */
export default function Page() {
  const configured = process.env.STRATEGY_RUNNER_ADDRESS?.trim();
  const houseRunner = configured && isAddress(configured) ? configured : null;
  return (
    <>
      <StrategiesScreen houseRunner={houseRunner} />
      <p className="container pb-10 type-caption text-ink-muted">{ADVICE_COPY.notAdvice}</p>
    </>
  );
}
