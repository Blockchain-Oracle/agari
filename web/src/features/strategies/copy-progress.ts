import { z } from "zod";
import type { VaultCaps, VaultGrant } from "@masayume/core/vault";

const integer = z.string().regex(/^\d+$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const copyProgressSchema = z.object({
  strategyId: integer, runner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  stage: z.enum(["grant-pending", "subscribe-ready", "subscribe-pending"]),
  releasePending: z.boolean().optional(), releaseTx: hash.nullable().optional(),
  previousGrantId: integer.nullable(), grantId: integer.nullable(),
  grantTx: hash.nullable(), subscribeTx: hash.nullable(), budgetBase: integer, feeBase: integer,
  expiresAtSec: z.number().int().positive(),
  caps: z.object({ maxStakePerTradeBase: integer, maxDailySpendBase: integer, maxOpenPositions: z.number().int().positive(), maxPriceRaw: integer }),
});
export type CopyProgress = z.infer<typeof copyProgressSchema>;
export const copyProgressKey = (wallet: string, vault: string) => `masayume.copy-progress:50312:${vault.toLowerCase()}:${wallet.toLowerCase()}`;
export function parseCopyProgress(raw: string | null): CopyProgress | null {
  try { const result = copyProgressSchema.safeParse(JSON.parse(raw ?? "null")); return result.success ? result.data : null; } catch { return null; }
}
export function progressCaps(progress: CopyProgress): VaultCaps {
  return { maxStakePerTradeBase: BigInt(progress.caps.maxStakePerTradeBase), maxDailySpendBase: BigInt(progress.caps.maxDailySpendBase), maxOpenPositions: progress.caps.maxOpenPositions, maxPriceRaw: BigInt(progress.caps.maxPriceRaw) };
}
/** A grant can resume only this exact operation; an unrelated replacement never counts as its first step. */
export function matchesProgressGrant(progress: CopyProgress, grant: VaultGrant | null): boolean {
  return Boolean(grant && !grant.revoked && grant.actor.toLowerCase() === progress.runner.toLowerCase()
    && (progress.grantId ? grant.grantId.toString() === progress.grantId : grant.grantId.toString() !== progress.previousGrantId && grant.budgetBase === BigInt(progress.budgetBase))
    && grant.expiresAtSec === progress.expiresAtSec
    && grant.caps.maxStakePerTradeBase === BigInt(progress.caps.maxStakePerTradeBase)
    && grant.caps.maxDailySpendBase === BigInt(progress.caps.maxDailySpendBase)
    && grant.caps.maxOpenPositions === progress.caps.maxOpenPositions && grant.caps.maxPriceRaw === BigInt(progress.caps.maxPriceRaw));
}
