import { formatUtc } from "@masayume/core/units";
import type { VaultGrant } from "@masayume/core/vault";
import { Hash, Money } from "@/components/data";
import { VAULT } from "./copy";
import type { VaultWriteKind } from "./useVaultWrite";

export interface VaultGrantsProps {
  grants: readonly VaultGrant[];
  decimals: number;
  symbol: string | null;
  busy: VaultWriteKind | null;
  disabled: boolean;
  onRevoke: (grantId: bigint) => void;
}

/** The live grants, one line each — what is allowed, to whom, how much is left, until when — and the one-call revoke (AD-5). */
export function VaultGrants({ grants, decimals, symbol, busy, disabled, onRevoke }: VaultGrantsProps) {
  if (grants.length === 0) return null;
  return (
    <div className="vault-grants" role="list" aria-label={VAULT.grants.title}>
      <span className="vault-eyebrow">{VAULT.grants.title}</span>
      {grants.map((grant) => (
        <div key={grant.grantId.toString()} role="listitem" className="vault-grant">
          <span className="type-body-strong text-ink">{VAULT.grants.kind[grant.kind]}</span>
          <Hash value={grant.actor} className="type-caption text-ink-secondary" />
          <span className="type-caption text-ink-secondary">
            {VAULT.grants.budget} <Money value={grant.budgetBase} decimals={decimals} symbol={symbol ?? undefined} />
          </span>
          <span className="type-caption text-ink-muted numbers">
            {VAULT.grants.expires} {formatUtc(grant.expiresAtSec * 1000, { withSeconds: false })}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={() => onRevoke(grant.grantId)} disabled={disabled || busy !== null} className="vault-btn vault-btn-outline" data-cursor="hover">
            {busy === "vault-revoke" ? VAULT.grants.revoking : VAULT.grants.revoke}
          </button>
        </div>
      ))}
      <span className="type-caption text-ink-muted">{VAULT.grants.revokeNote}</span>
    </div>
  );
}
