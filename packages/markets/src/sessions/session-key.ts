import type { IntentJournal } from "@masayume/core/ports";
import type { Address, Hex } from "@masayume/core/types";
import { createWalletClient, http, type PublicClient, type WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SOMNIA_SHANNON } from "../chain";
import { getClient } from "../runtime/read-runtime";
import type { MarketsEnv } from "../env";
import { requiredGasWei } from "../submitter/gas";
import { awaitReceipt } from "../vault/write";
import type { SponsorTransport } from "../vault/sponsor";
import type { AuthorityKind } from "./authority";
import { createSubmitterSession, type SubmitterSession } from "./submitter-session";

/**
 * A browser-held session key (AD-5 SESSION grant, Story 6.3).
 *
 * The key is an ordinary EVM account the browser generates and keeps for itself. It signs the
 * owner's taps under a SESSION grant the owner created in the vault; it can never withdraw,
 * because nothing in the vault pays anyone but the owner. Losing the key loses the convenience,
 * never the money — the owner revokes the grant and its budget returns to their balance.
 */
export interface SessionKeyRecord {
  owner: Address;
  address: Address;
  privateKey: Hex;
  createdAtMs: number;
}

export function generateSessionKey(owner: Address, nowMs: number = Date.now()): SessionKeyRecord {
  const privateKey = generatePrivateKey();
  return { owner, address: privateKeyToAccount(privateKey).address as Address, privateKey, createdAtMs: nowMs };
}

export interface SessionKeySessionConfig {
  env: MarketsEnv;
  privateKey: Hex;
  /** The tap-trade key by default; the duel's per-match key signs under `game-session` so the journal names it. */
  authority?: Extract<AuthorityKind, "session-key" | "game-session">;
  journal: IntentJournal;
  nowMs?: () => number;
  /** When a relayer pays for the key's taps; without it the key pays from its own STT. */
  sponsor?: SponsorTransport;
}

/** The key's own signing session: its own SDK instance, nonce queue and journal, disposed when the grant ends. */
export function createSessionKeySession(config: SessionKeySessionConfig): Promise<SubmitterSession> {
  return createSubmitterSession({
    env: config.env,
    authority: config.authority ?? "session-key",
    signer: { privateKey: config.privateKey },
    journal: config.journal,
    ...(config.nowMs ? { nowMs: config.nowMs } : {}),
    ...(config.sponsor ? { sponsor: config.sponsor } : {}),
  });
}

/** What the order lane's own gas gate will accept from the key: the vault-order envelope with its safety factor. */
export function sessionGasTopUpWei(): bigint {
  return requiredGasWei("vault-order");
}

export function sessionKeyClient(privateKey: Hex, env: MarketsEnv): WalletClient {
  return createWalletClient({ account: privateKeyToAccount(privateKey), chain: SOMNIA_SHANNON, transport: http(env.rpcHttpUrls[0]) });
}

export interface TopUpInput {
  ownerWalletClient: WalletClient;
  key: Address;
  amountWei: bigint;
}

/** The owner moves STT to the key so it can pay for its own taps when no sponsor will. A plain transfer, waited on. */
export async function topUpSessionGas({ ownerWalletClient, key, amountWei }: TopUpInput): Promise<Hex> {
  const account = ownerWalletClient.account;
  if (!account) throw new Error("the owner's wallet client has no account bound");
  const hash = await ownerWalletClient.sendTransaction({ account, chain: SOMNIA_SHANNON, to: key, value: amountWei });
  await awaitReceipt(getClient().getViemClient() as PublicClient, hash, "session gas top-up");
  return hash;
}

/** The key's own STT — what it can pay for itself when no sponsor will. */
export function keyGasBalance(key: Address): Promise<bigint> {
  return getClient().getNativeBalance(key);
}
