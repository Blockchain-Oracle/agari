import type { GrantTerms } from "@masayume/core/ports";
import { minStakeBase } from "@masayume/core/sizing";
import type { Address } from "@masayume/core/types";
import { formatBaseUnits, oneCent, oneUnit, parseDecimalToBaseUnits } from "@masayume/core/units";
import type { VaultGrant } from "@masayume/core/vault";
import { SESSION } from "./copy";

export interface CapsForm {
  perTradeText: string;
  dailyText: string;
  positions: number;
  /** Dearest odds the key may pay, in cents of a whole unit; 0 = no cap. */
  priceCents: number;
  expiryHours: number;
  depositText: string;
}

export const EXPIRY_CHOICES = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 24 * 7, label: "7d" },
] as const;

export const CAPS_DEFAULTS: CapsForm = { perTradeText: "5", dailyText: "25", positions: 4, priceCents: 95, expiryHours: 24, depositText: "25" };

export type TermsResult = { ok: true; amountBase: bigint; terms: GrantTerms } | { ok: false; error: string };

/** The form, checked once and turned into the grant the contract will hold. Every refusal names its field. */
export function termsFromForm(form: CapsForm, decimals: number, actor: Address, nowSec: number): TermsResult {
  const perTrade = parseDecimalToBaseUnits(form.perTradeText, decimals);
  const daily = parseDecimalToBaseUnits(form.dailyText, decimals);
  const deposit = parseDecimalToBaseUnits(form.depositText, decimals);
  if (perTrade === null || perTrade < minStakeBase(decimals)) return { ok: false, error: SESSION.sheet.errors.perTrade };
  if (daily === null || daily < perTrade) return { ok: false, error: SESSION.sheet.errors.daily };
  if (deposit === null || deposit < perTrade) return { ok: false, error: SESSION.sheet.errors.deposit };
  if (form.priceCents < 0 || form.priceCents > 99) return { ok: false, error: SESSION.sheet.errors.price };
  if (form.positions < 1) return { ok: false, error: SESSION.sheet.errors.positions };
  return {
    ok: true,
    amountBase: deposit,
    terms: {
      kind: "session",
      actor,
      caps: {
        maxStakePerTradeBase: perTrade,
        maxDailySpendBase: daily,
        maxOpenPositions: form.positions,
        maxPriceRaw: form.priceCents === 0 ? 0n : BigInt(form.priceCents) * oneCent(decimals),
      },
      expiresAtSec: nowSec + form.expiryHours * 3600,
      budgetBase: deposit,
    },
  };
}

/** The sizing sentence at the chosen size — the arithmetic the caps actually imply, not a slogan. */
export function workedExample(form: CapsForm, decimals: number, symbol: string): string | null {
  const perTrade = parseDecimalToBaseUnits(form.perTradeText, decimals);
  const daily = parseDecimalToBaseUnits(form.dailyText, decimals);
  const deposit = parseDecimalToBaseUnits(form.depositText, decimals);
  if (!perTrade || !daily || !deposit || perTrade === 0n) return null;
  const money = (base: bigint) => `${formatBaseUnits(base, decimals, { minDp: 0 })} ${symbol}`;
  const byDaily = Number(daily / perTrade);
  const byBudget = Number(deposit / perTrade);
  if (byBudget < byDaily) return SESSION.sheet.exampleShortBudget(money(perTrade), byBudget, money(deposit));
  return SESSION.sheet.example(money(perTrade), byDaily, money(daily), money(deposit));
}

/** Re-keying keeps the terms the owner already approved; only the actor changes. */
export function termsFromGrant(grant: VaultGrant, actor: Address): GrantTerms {
  return { kind: "session", actor, caps: grant.caps, expiresAtSec: grant.expiresAtSec, budgetBase: grant.budgetBase };
}

export function priceCapText(grant: VaultGrant, decimals: number): string | null {
  if (grant.caps.maxPriceRaw === 0n) return null;
  return `${Number((grant.caps.maxPriceRaw * 100n) / oneUnit(decimals))}¢`;
}
