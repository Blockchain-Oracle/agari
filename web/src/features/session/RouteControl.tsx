"use client";

import { formatBaseUnits } from "@masayume/core/units";
import { SESSION } from "./copy";
import type { FundingSource } from "./useTicketRoute";

interface RouteControlProps {
  source: FundingSource;
  onChange: (source: FundingSource) => void;
  vaultAvailableBase: bigint | null;
  decimals: number;
  symbol: string;
  /** With a session armed, taps come from the Vault and the choice is shown, not offered. */
  armed: boolean;
  deployed: boolean;
  /** The reference's Private option: shown where a desk is deployed, disabled with the reason where it cannot run. */
  privateOption?: { label: string; enabled: boolean; title: string; retry: (() => void) | null; retryLabel: string } | undefined;
}

/**
 * Where the escrow comes from — the reference's Public/Private two-option control
 * (`Ticket624Drawer.tsx` L1180–1205), in the `.tk-modes` grammar already ported for bet types,
 * carrying the one line that changes what happens to money.
 */
export function RouteControl({ source, onChange, vaultAvailableBase, decimals, symbol, armed, deployed, privateOption }: RouteControlProps) {
  const vaultEmpty = (vaultAvailableBase ?? 0n) === 0n;
  const effective: FundingSource = armed && source !== "private" ? "vault" : source;
  const vaultTitle = !deployed ? SESSION.notDeployed : vaultEmpty && !armed ? SESSION.route.vaultEmpty : `${formatBaseUnits(vaultAvailableBase ?? 0n, decimals)} ${symbol}`;
  return (
    <div className="tk-lev-row">
      <span className="tk-control-label">{SESSION.route.label}</span>
      <div className="tk-modes" role="group" aria-label={SESSION.route.label}>
        <button
          type="button"
          className="tk-mode"
          aria-pressed={effective === "wallet"}
          disabled={armed}
          title={armed ? SESSION.route.armedLocked : undefined}
          onClick={() => onChange("wallet")}
          data-cursor="hover"
        >
          {SESSION.route.wallet}
        </button>
        <button
          type="button"
          className="tk-mode"
          aria-pressed={effective === "vault"}
          disabled={(armed && source !== "private") || !deployed || (vaultEmpty && !armed)}
          title={vaultTitle}
          onClick={() => onChange("vault")}
          data-cursor="hover"
        >
          {SESSION.route.vault}
        </button>
        {privateOption && (
          <button
            type="button"
            className="tk-mode tk-mode--private"
            aria-pressed={effective === "private"}
            disabled={!privateOption.enabled && effective !== "private"}
            title={privateOption.title}
            onClick={() => onChange("private")}
            data-cursor="hover"
          >
            {privateOption.label}
          </button>
        )}
      </div>
      {privateOption?.retry && (
        <button type="button" onClick={privateOption.retry} className="tk-control-label" data-cursor="hover">
          {privateOption.retryLabel}
        </button>
      )}
    </div>
  );
}
