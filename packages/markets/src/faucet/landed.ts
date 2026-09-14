import type { AnyFaucetClaim } from "@agari/core/faucet";

/** The fields of a `getTransaction(…, { encoding: "jsonParsed" })` result the faucet reads. Kit turns JSON numbers into bigints. */
interface ParsedInstruction { program?: string; parsed?: { type?: string; info?: Record<string, unknown> } }
interface ParsedTransaction { transaction?: { message?: { accountKeys?: readonly { pubkey?: unknown }[]; instructions?: readonly ParsedInstruction[] } } }

/** Where a tUSDC claim must have minted: the collateral mint, the wallet's ATA and the faucet's mint authority. */
export interface MintTarget { mint: string; ata: string; authority: string }

const same = (value: unknown, expected: string) => value !== undefined && value !== null && String(value) === expected;

/**
 * Whether a landed transaction is the one the journal committed: paid by the funder, and moving exactly the claim's
 * amount to the claim's wallet. Anything else under the journaled signature is a `conflict` for an operator.
 */
export function landedAsJournaled(landed: unknown, claim: AnyFaucetClaim, target: MintTarget | null): boolean {
  const message = (landed as ParsedTransaction | null)?.transaction?.message;
  if (!message?.instructions || !same(message.accountKeys?.[0]?.pubkey, claim.funder)) return false;
  return message.instructions.some(({ program, parsed }) => {
    const info = parsed?.info ?? {};
    if (claim.asset === "sol") {
      return program === "system" && parsed?.type === "transfer" && same(info.source, claim.funder) && same(info.destination, claim.wallet) && same(info.lamports, claim.amountLamports);
    }
    const tokenAmount = info.tokenAmount as { amount?: unknown } | undefined;
    return target !== null && program === "spl-token" && parsed?.type === "mintToChecked" && same(info.mint, target.mint) && same(info.account, target.ata) && same(info.mintAuthority, target.authority) && same(tokenAmount?.amount, claim.amountBase);
  });
}
