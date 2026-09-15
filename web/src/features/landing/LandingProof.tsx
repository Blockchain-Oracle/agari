import type { Address } from "@agari/core/types";
import { addressUrl } from "@agari/core/urls";
import { webEnv } from "@/lib/env";
import { shortAddress } from "../strategies/names";
import { LANDING } from "./copy";
import { SettledWindows } from "./SettledWindows";

function AddressCell({ label, address }: { label: string; address: Address | undefined }) {
  return (
    <div className="lp-proof-cell">
      <dt className="lp-proof-label">{label}</dt>
      <dd className="lp-proof-value">
        {address ? (
          <a href={addressUrl(address, webEnv.markets.cluster)} target="_blank" rel="noreferrer" className="lp-link lp-address" aria-label={LANDING.proof.explorerAria(label)} title={address} data-cursor="hover">
            {shortAddress(address)}
          </a>
        ) : (
          <span className="lp-note">{LANDING.proof.unset}</span>
        )}
      </dd>
    </div>
  );
}

/**
 * The proof strip: the program and its venue config as the app itself is configured (the same `NEXT_PUBLIC_*` values the
 * markets port boots from, which `program-id-drift` holds to `addresses.devnet.json`), then the last settled Windows.
 * The addresses render on the server; only the settled list is a client island.
 */
export function LandingProof() {
  const { eventsProgramId, venueId } = webEnv.markets;
  return (
    <div className="lp-proof">
      <dl className="lp-proof-ids">
        <AddressCell label={LANDING.proof.program} address={eventsProgramId} />
        <AddressCell label={LANDING.proof.venue} address={venueId} />
        <div className="lp-proof-cell">
          <dt className="lp-proof-label">{LANDING.proof.clusterLabel}</dt>
          <dd className="lp-proof-value">{LANDING.proof.cluster}</dd>
        </div>
      </dl>
      <SettledWindows venueId={venueId ?? null} />
    </div>
  );
}
