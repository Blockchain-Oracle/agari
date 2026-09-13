import type { BalanceSheet } from "@masayume/core/types";
import { requiredGasWei } from "@masayume/markets";
import { SOMNIA_SHANNON } from "@masayume/markets/chain";
import { Money } from "@/components/data";
import { StaleTick, type ReadingMeta } from "@/components/states";
import type { ReactNode } from "react";
import { VaultRow } from "@/features/vault";
import { BALANCE } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { PoolRow } from "./PoolRow";

const NATIVE = SOMNIA_SHANNON.nativeCurrency;
const GAS_DP = 4;

interface BalanceSheetPanelProps {
  sheet: BalanceSheet;
  symbol: string | null;
  /** Present when the sheet is last-known-good: rendered at full ink with its "as of" tick inside the plate. */
  stale?: ReadingMeta | null;
  /** Controls that belong to a pool, folded into that pool's own row (the reference's `PoolRows` panels). With a vault panel the row is always listed, so a network without a vault still says so in place. */
  panels?: { vault?: ReactNode };
  className?: string;
}

/** The headline is wallet-spendable collateral only; every other pool is a labeled row beneath it, never summed (FR-5). */
export function BalanceSheetPanel({ sheet, symbol, stale, panels, className }: BalanceSheetPanelProps) {
  const collateral = symbol ?? undefined;
  // An order is the dearest lane a bettor signs; below its envelope the next write is refused before any popup.
  const gasLow = sheet.nativeWei < requiredGasWei("order");

  return (
    <div className={cn("flex flex-col gap-3 rounded-(--balance-plate-radius) bg-(--balance-plate-surface) p-4", className)}>
      <div className="flex flex-col gap-1">
        <span className="type-label-micro text-ink-secondary">{symbol ? `${BALANCE.spendable} · ${symbol}` : BALANCE.spendable}</span>
        <Money value={sheet.spendableBase} decimals={sheet.decimals} className="type-data-hero text-ink" />
        <span className="type-caption text-ink-muted">{BALANCE.headlineNote}</span>
      </div>

      <div role="list" aria-label={BALANCE.poolsLabel} className="flex flex-col">
        {(sheet.vaultBase !== null || panels?.vault) && <VaultRow value={sheet.vaultBase} decimals={sheet.decimals} symbol={collateral} panel={panels?.vault} />}
        <PoolRow
          label={BALANCE.rows.escrow}
          value={sheet.orderEscrowBase}
          decimals={sheet.decimals}
          symbol={collateral}
          note={sheet.orderEscrowBase > 0n ? BALANCE.escrowNote : undefined}
        />
        {sheet.venueCreditBase > 0n && (
          <PoolRow label={BALANCE.rows.credit} value={sheet.venueCreditBase} decimals={sheet.decimals} symbol={collateral} note={BALANCE.creditFirst} />
        )}
        <PoolRow
          label={BALANCE.rows.gas}
          value={sheet.nativeWei}
          decimals={NATIVE.decimals}
          symbol={NATIVE.symbol}
          maxDp={GAS_DP}
          warning={gasLow}
          note={gasLow ? BALANCE.gasLow : undefined}
        />
      </div>

      {stale?.stale && <StaleTick asOfMs={stale.asOfMs} reason={stale.staleReason} />}
    </div>
  );
}
