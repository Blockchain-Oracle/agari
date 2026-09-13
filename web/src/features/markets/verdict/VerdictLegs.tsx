import { OUTCOME_TO_SIDE, type ClaimLeg } from "@masayume/core/types";
import { Money } from "@/components/data";
import { MARKETS, VERDICT_UI } from "@/lib/copy";

interface VerdictLegsProps {
  legs: readonly ClaimLeg[];
  decimals: number;
  symbol: string;
}

const SIDE_WORD = { up: MARKETS.up, down: MARKETS.down } as const;

/** Every side the wallet held, in words: a losing leg is listed at payout 0 rather than hidden. */
export function VerdictLegs({ legs, decimals, symbol }: VerdictLegsProps) {
  return (
    <dl className="flex flex-col gap-2" aria-label={VERDICT_UI.legs}>
      {legs.map((leg) => (
        <div key={leg.outcomeIdx} className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2 type-data">
          <dt className="flex items-baseline gap-2">
            <span className="type-body-strong text-ink">{SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]}</span>
            <span className="text-ink-secondary">
              <Money value={leg.amountRaw} decimals={decimals} /> {VERDICT_UI.contracts}
            </span>
          </dt>
          <dd className="text-ink-secondary">
            {VERDICT_UI.payout} <Money value={leg.payoutBase} decimals={decimals} symbol={symbol} className="text-ink" />
          </dd>
        </div>
      ))}
    </dl>
  );
}
