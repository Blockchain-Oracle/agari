import { formatBaseUnits } from "@agari/core/units";
import { COPY_FORM } from "./copy-form-copy";
import { parseAmount } from "./format";

/**
 * The copy drawer's form, checked in one place (S23). Every reason the confirm button can be off is named here, in
 * the order a person can fix them, and each field carries its own red line. Pure, so the rules are tested and the
 * drawer only renders what this returns. Money stays in base units.
 */
export interface CopyFormInput {
  budgetText: string;
  perTradeText: string;
  decimals: number;
  symbol: string;
  /** The strategy's own per-trade ceiling. */
  strategyMaxBase: bigint;
  /** The wallet's tUSDC; null while it is being read. */
  walletBase: bigint | null;
  /** Vault funds this setup can reuse: available balance plus the current grant's unspent budget. */
  reusableBase: bigint;
  feeBase: bigint | null;
  feeError: string | null;
  busy: boolean;
  canSign: boolean;
  readable: boolean;
  /** Another strategy's unfinished setup, by id. */
  otherPendingId: string | null;
  releasePending: boolean;
  /** This strategy's saved setup: its numbers are fixed, so the fields are not re-checked. */
  resuming: boolean;
}

export interface CopyFormCheck {
  budgetBase: bigint;
  perTradeBase: bigint;
  budgetError: string | null;
  perTradeError: string | null;
  /** The first reason the confirm button is off, or null when it can be pressed. */
  blockedBy: string | null;
  /** What this setup pulls from the wallet on top of reusable funds. */
  topUpBase: bigint;
  /** Max for the budget: everything the wallet and the vault can put in, less the fee. */
  maxBudgetBase: bigint | null;
  /** Max for per trade: the strategy's ceiling, never more than the budget. */
  maxPerTradeBase: bigint;
}

const money = (base: bigint, decimals: number, symbol: string) => `${formatBaseUnits(base, decimals)} ${symbol}`;
const malformed = (text: string, decimals: number) => text.trim() !== "" && parseAmount(text, decimals) === 0n && !/^0*(?:\.0*)?$/.test(text.trim());

export function checkCopyForm(i: CopyFormInput): CopyFormCheck {
  const budgetBase = parseAmount(i.budgetText, i.decimals);
  const perTradeBase = parseAmount(i.perTradeText, i.decimals);
  const topUpBase = budgetBase > i.reusableBase ? budgetBase - i.reusableBase : 0n;
  const fee = i.feeBase ?? 0n;
  const pool = i.walletBase === null ? null : i.walletBase + i.reusableBase - fee;
  const maxBudgetBase = pool === null ? null : pool > 0n ? pool : 0n;
  const maxPerTradeBase = budgetBase > 0n && budgetBase < i.strategyMaxBase ? budgetBase : i.strategyMaxBase;

  let budgetError: string | null = null;
  let perTradeError: string | null = null;
  if (!i.resuming) {
    if (malformed(i.budgetText, i.decimals)) budgetError = COPY_FORM.notANumber;
    else if (i.walletBase !== null && topUpBase + fee > i.walletBase) budgetError = COPY_FORM.walletShort(money(i.walletBase, i.decimals, i.symbol), money(topUpBase + fee, i.decimals, i.symbol));
    if (malformed(i.perTradeText, i.decimals)) perTradeError = COPY_FORM.notANumber;
    else if (perTradeBase > i.strategyMaxBase) perTradeError = COPY_FORM.aboveStrategy(money(i.strategyMaxBase, i.decimals, i.symbol));
    else if (budgetBase > 0n && perTradeBase > budgetBase) perTradeError = COPY_FORM.aboveBudget;
  }

  const blockedBy =
    i.busy ? COPY_FORM.blocked.busy
    : !i.canSign ? COPY_FORM.blocked.cannotSign
    : !i.readable ? COPY_FORM.blocked.checking
    : i.otherPendingId !== null ? COPY_FORM.blocked.otherPending(i.otherPendingId)
    : i.releasePending ? COPY_FORM.blocked.releasePending
    : i.resuming ? (i.feeBase === null ? i.feeError ?? COPY_FORM.blocked.feeLoading : null)
    : budgetBase <= 0n ? COPY_FORM.blocked.noBudget
    : perTradeBase <= 0n ? COPY_FORM.blocked.noPerTrade
    : perTradeError ?? budgetError
    ?? (i.feeBase === null ? i.feeError ?? COPY_FORM.blocked.feeLoading : null);

  return { budgetBase, perTradeBase, budgetError, perTradeError, blockedBy, topUpBase, maxBudgetBase, maxPerTradeBase };
}
