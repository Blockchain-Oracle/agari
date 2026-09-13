import { STT_FAUCETS } from "@masayume/core/constants";
import type { Address } from "@masayume/core/types";
import { Hash } from "@/components/data";
import { Button } from "@/components/ui/button";
import { FAUCET, OUT_OF_GAS } from "@/lib/copy";

interface GasRoutingProps {
  address: Address;
  onRecheck: () => void;
  checking: boolean;
}

/** Shown BEFORE any signing when the STT tank is empty: where to fuel, in preference order, with fallbacks. */
export function GasRouting({ address, onRecheck, checking }: GasRoutingProps) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-2 p-3">
      <p className="type-body-strong text-ink">{FAUCET.gasTitle}</p>
      <p className="type-caption text-ink-secondary">{OUT_OF_GAS}</p>
      <p className="type-caption text-ink-secondary">
        {FAUCET.yourAddress} <Hash value={address} lead={10} tail={6} className="text-ink" />
      </p>
      <ul className="flex flex-col gap-2">
        {STT_FAUCETS.map((faucet) => (
          <li key={faucet.url}>
            <a
              href={faucet.url}
              target="_blank"
              rel="noreferrer"
              className="type-body text-ink underline decoration-hairline underline-offset-4 hover:decoration-accent"
            >
              {faucet.name} →
            </a>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" onClick={onRecheck} disabled={checking} className="self-start">
        {FAUCET.recheck}
      </Button>
    </div>
  );
}
