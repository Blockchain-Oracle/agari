"use client";

import type { BlockerKind } from "@masayume/core/copy";
import type { Reading } from "@masayume/core/schemas";
import type { VenueCredit } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import type { VaultSnapshot } from "@masayume/core/vault";
import { ErrorState, LoadingState, StaleTick } from "@/components/states";
import { cn } from "@/lib/utils";
import { VAULT } from "./copy";
import { NotDeployedNote } from "./NotDeployedNote";
import { grantsBudgetBase, liveGrants } from "./useVaultAccount";
import type { VaultWriteKind } from "./useVaultWrite";
import { VaultCells } from "./VaultCells";
import { VaultControls } from "./VaultControls";
import { VaultGrants } from "./VaultGrants";
import "./vault.css";

export interface TradingBalanceViewProps {
  reading: Reading<VaultSnapshot | null> | null;
  symbol: string | null;
  walletSpendableBase: bigint | null;
  needsApproval: boolean;
  /** Open Windows the vault holds and their cost; null while unread. */
  open: { count: number; stakeBase: bigint } | null;
  poolCredit: readonly VenueCredit[];
  blocker: BlockerKind | null;
  busy: VaultWriteKind | null;
  onDeposit: (amountBase: bigint) => void;
  onWithdraw: () => void;
  onWithdrawPrivate: () => void;
  onRevoke: (grantId: bigint) => void;
  onSweep: (credit: VenueCredit) => void;
  retry?: () => void;
  /** Inside a pool row's disclosure the block drops its top rule; standalone it keeps the reference's. */
  inline?: boolean;
  className?: string;
}

/** The reference's Trading balance block (L416–466): eyebrow and sentence, the controls, the snapshot cells, then what we add — the grants list. */
export function TradingBalanceView(props: TradingBalanceViewProps) {
  const { reading, symbol, walletSpendableBase, needsApproval, open, poolCredit, blocker, busy, onDeposit, onWithdraw, onWithdrawPrivate, onRevoke, onSweep, retry, inline, className } = props;
  const frame = cn("vault-panel", inline && "vault-panel-inline", className);

  if (reading === null) return <LoadingState shape="row" className={frame} />;
  if (!reading.ok) return <ErrorState diagnosis={reading.error} retry={retry} className={frame} />;
  const snapshot = reading.value;
  if (snapshot === null) return <NotDeployedNote className={frame} />;

  const { decimals, account } = snapshot;
  const grants = liveGrants(snapshot);

  return (
    <div className={frame}>
      <div className="vault-head">
        <div>
          <span className="vault-eyebrow">{VAULT.eyebrow}</span>
          <p className="vault-note">{VAULT.note}</p>
        </div>
        <VaultControls
          decimals={decimals}
          availableBase={account.availableBase}
          privateAvailableBase={account.privateAvailableBase}
          walletSpendableBase={walletSpendableBase}
          needsApproval={needsApproval}
          blocker={blocker}
          busy={busy}
          onDeposit={onDeposit}
          onWithdraw={onWithdraw}
          onWithdrawPrivate={onWithdrawPrivate}
        />
      </div>

      <VaultCells
        decimals={decimals}
        walletSpendableBase={walletSpendableBase}
        availableBase={account.availableBase}
        privateAvailableBase={account.privateAvailableBase}
        grantsBudgetBase={grantsBudgetBase(snapshot)}
        inTradesBase={open?.stakeBase ?? null}
        positions={open?.count ?? null}
      />
      <p className="vault-loading">{VAULT.positionsNote}</p>

      <VaultGrants grants={grants} decimals={decimals} symbol={symbol} busy={busy} disabled={blocker !== null} onRevoke={onRevoke} />

      {poolCredit.map((credit) => (
        <div key={credit.pool} className="vault-grant vault-grants">
          <span className="type-caption text-ink-secondary">{VAULT.sweep.note(`${formatBaseUnits(credit.amountBase, decimals)} ${symbol ?? ""}`.trim())}</span>
          <button type="button" onClick={() => onSweep(credit)} disabled={blocker !== null || busy !== null} className="vault-btn vault-btn-outline" data-cursor="hover">
            {busy === "vault-sweep" ? VAULT.sweep.sweeping : VAULT.sweep.action}
          </button>
        </div>
      ))}

      {reading.stale && <StaleTick asOfMs={reading.asOfMs} reason={reading.staleReason} />}
    </div>
  );
}
