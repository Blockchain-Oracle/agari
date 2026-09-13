import type { ReactNode } from "react";
import { Money } from "@/components/data";
import { VAULT } from "./copy";
import "./vault.css";

interface VaultRowProps {
  /** null where no vault is deployed — rendered as a placeholder, never a fake 0.00. */
  value: bigint | null;
  decimals: number;
  symbol?: string;
  /** The controls that belong to this pool, revealed by clicking the row itself (`PoolRows.tsx`: "a row with controls IS its own disclosure"). */
  panel?: ReactNode;
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

function Body({ value, decimals, symbol }: Pick<VaultRowProps, "value" | "decimals" | "symbol">) {
  return (
    <div className="flex flex-1 items-baseline justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="type-caption text-ink-secondary">{VAULT.row.label}</span>
        <span className="type-caption text-ink-muted">{VAULT.row.note}</span>
      </div>
      <span className="shrink-0 type-data text-ink">{value === null ? VAULT.row.unknown : <Money value={value} decimals={decimals} symbol={symbol} />}</span>
    </div>
  );
}

/** The Trading Balance's pool row under the plate — label, the one sentence saying what it is for and who can move it, the amount; with its controls folded inside when it has any. */
export function VaultRow({ value, decimals, symbol, panel }: VaultRowProps) {
  if (!panel) {
    return (
      <div role="listitem" className="border-t border-hairline">
        <Body value={value} decimals={decimals} symbol={symbol} />
      </div>
    );
  }
  return (
    <details role="listitem" className="border-t border-hairline">
      <summary className="vault-row-summary" data-cursor="hover">
        <Body value={value} decimals={decimals} symbol={symbol} />
        <span className="vault-row-chevron">
          <Chevron />
        </span>
      </summary>
      <div className="pb-4">{panel}</div>
    </details>
  );
}
