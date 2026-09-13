import { Money } from "@/components/data";
import { cn } from "@/lib/utils";
import { VAULT } from "./copy";

export interface VaultCellsProps {
  decimals: number;
  walletSpendableBase: bigint | null;
  availableBase: bigint;
  privateAvailableBase: bigint;
  grantsBudgetBase: bigint;
  /** Cost of what the vault still holds open for this wallet; null while the open-bets read is pending. */
  inTradesBase: bigint | null;
  positions: number | null;
}

function Cell({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div>
      <span className="vault-cell-label">{label}</span>
      <div className="vault-cell-value">{children}</div>
      {note && <span className="type-caption text-ink-muted">{note}</span>}
    </div>
  );
}

/** The reference's snapshot cells (L358–412), kept to the ones the vault can state truthfully; "in play" cells take the accent the way "In trades" and "Agent" did. */
export function VaultCells({ decimals, walletSpendableBase, availableBase, privateAvailableBase, grantsBudgetBase, inTradesBase, positions }: VaultCellsProps) {
  return (
    <div className="vault-cells">
      <Cell label={VAULT.cells.wallet}>{walletSpendableBase === null ? VAULT.none : <Money value={walletSpendableBase} decimals={decimals} />}</Cell>
      <Cell label={VAULT.cells.available}>
        <Money value={availableBase} decimals={decimals} />
      </Cell>
      <Cell label={VAULT.cells.inTrades} note={inTradesBase !== null && inTradesBase > 0n ? VAULT.cells.inTradesNote : undefined}>
        {inTradesBase === null ? VAULT.none : <Money value={inTradesBase} decimals={decimals} className={cn(inTradesBase > 0n && "vault-cell-value-live")} />}
      </Cell>
      <Cell label={VAULT.cells.private}>
        <Money value={privateAvailableBase} decimals={decimals} />
      </Cell>
      <Cell label={VAULT.cells.grants}>
        {grantsBudgetBase > 0n ? <Money value={grantsBudgetBase} decimals={decimals} className="vault-cell-value-live" /> : VAULT.none}
      </Cell>
      <Cell label={VAULT.cells.positions}>{positions === null ? VAULT.none : positions}</Cell>
    </div>
  );
}
