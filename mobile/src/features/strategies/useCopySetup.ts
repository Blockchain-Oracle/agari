import { isOk } from "@agari/core/schemas";
import type { StrategySubscription } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import type { VaultGrant } from "@agari/core/vault";
import { useBalanceSheet } from "@agari/markets/react";
import { useState } from "react";
import { checkCopyForm } from "@/features/strategies/copy-form";
import { progressCaps } from "@/features/strategies/copy-progress";
import { capsFor, money, parseAmount } from "@/features/strategies/format";
import { copyStateOf } from "@/features/strategies/lifecycle";
import type { StrategyWire } from "@/features/strategies/protocol";
import type { DeskWriteResult, useDeskWrites } from "@/features/strategies/useDeskWrites";
import { useSubscriptionFee } from "@/features/strategies/useSubscriptionFee";

export type DeskWrites = ReturnType<typeof useDeskWrites>;

/**
 * The copy drawer's model (web's features/strategies/CopyDrawer.tsx), without its view: the form's text, the saved
 * setup that fixes its numbers, the caps the vault will be asked for, the live subscription fee and web's own
 * `checkCopyForm` verdict. Every write goes through web's useDeskWrites.
 */
export function useCopySetup({ card, sub, grant, readable, writes, availableBase, decimals, symbol, nowMs }: {
  card: StrategyWire;
  sub: StrategySubscription | null;
  grant: VaultGrant | null;
  readable: boolean;
  writes: DeskWrites;
  availableBase: bigint;
  decimals: number;
  symbol: string;
  nowMs: number;
}) {
  const ownGrant = grant && sub?.grantId === grant.grantId && !grant.revoked ? grant : null;
  const [budget, setBudget] = useState(() => (ownGrant ? money(ownGrant.budgetBase, decimals).replace(/,/g, "") : ""));
  const [perTrade, setPerTrade] = useState(() =>
    money(ownGrant?.caps.maxStakePerTradeBase ?? BigInt(card.envelope.maxStakePerTradeBase), decimals).replace(/,/g, ""),
  );
  const [result, setResult] = useState<DeskWriteResult | null>(null);
  // A-1c: an active consent fixes the direction; the program refuses a wallet holding both.
  const [fade, setFade] = useState(() => sub?.fade ?? false);
  const directionLocked = Boolean(sub?.active);
  const fading = directionLocked ? Boolean(sub?.fade) : fade;
  const currentFee = useSubscriptionFee(card.strategyId, writes.busy);
  const state = copyStateOf(card, sub, grant, Math.floor(nowMs / 1000), readable);
  const pending = writes.pending?.strategyId === card.strategyId ? writes.pending : null;
  const anotherPending = Boolean(writes.pending && !pending);
  const targetBase = pending ? BigInt(pending.budgetBase) : parseAmount(budget, decimals);
  const ceilingBase = pending ? BigInt(pending.caps.maxStakePerTradeBase) : parseAmount(perTrade, decimals);
  const envelope = {
    maxStakePerTradeBase: BigInt(card.envelope.maxStakePerTradeBase),
    maxDailySpendBase: BigInt(card.envelope.maxDailySpendBase),
    maxOpenPositions: card.envelope.maxOpenPositions,
    maxPriceRaw: BigInt(card.envelope.maxPriceRaw),
  };
  const caps = pending ? progressCaps(pending) : capsFor("balanced", ceilingBase, targetBase, decimals, envelope);
  const reusable = availableBase + (grant && !grant.revoked ? grant.budgetBase : 0n);
  const topUp = !pending && targetBase > reusable ? targetBase - reusable : 0n;
  const disabled = Boolean(writes.busy) || !writes.canSign || !readable || anotherPending;
  const sheet = useBalanceSheet(writes.address);
  const walletBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const check = checkCopyForm({
    budgetText: budget,
    perTradeText: perTrade,
    decimals,
    symbol,
    strategyMaxBase: envelope.maxStakePerTradeBase,
    walletBase,
    reusableBase: reusable,
    feeBase: currentFee.fee,
    feeError: currentFee.error,
    busy: Boolean(writes.busy),
    canSign: writes.canSign,
    readable,
    otherPendingId: anotherPending ? (writes.pending?.strategyId ?? null) : null,
    releasePending: Boolean(pending?.releasePending),
    resuming: Boolean(pending),
  });
  const valid = targetBase > 0n && ceilingBase > 0n && ceilingBase <= envelope.maxStakePerTradeBase && ceilingBase <= targetBase;

  const perform = async (operation: () => Promise<DeskWriteResult>) => {
    setResult(null);
    try {
      setResult(await operation());
    } catch (error) {
      setResult({ ok: false, reason: error instanceof Error ? error.message : "The wallet action needs checking." });
    }
    currentFee.refresh();
  };

  const join = () => {
    if (check.blockedBy !== null || !valid || currentFee.fee === null) return Promise.resolve();
    const feeBase = currentFee.fee;
    return perform(() =>
      writes.join({ strategyId: BigInt(card.strategyId), runner: card.runner as Address, depositBase: topUp, budgetBase: targetBase, caps, feeBase, fade: fading }),
    );
  };

  return {
    ownGrant,
    budget,
    setBudget,
    perTrade,
    setPerTrade,
    result,
    fade: fading,
    setFade,
    directionLocked,
    currentFee,
    state,
    pending,
    anotherPending,
    targetBase,
    ceilingBase,
    envelope,
    caps,
    topUp,
    disabled,
    walletBase,
    check,
    valid,
    perform,
    join,
  };
}

export type CopySetup = ReturnType<typeof useCopySetup>;
