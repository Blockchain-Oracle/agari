import type { IntentJournal } from "@agari/core/ports";
import type { Address } from "@agari/core/types";
import { generateKeyPair, getAddressFromPublicKey } from "@solana/kit";
import type { MarketsEnv } from "../env";
import type { WriteRpc } from "../submitter/steps/message";
import type { SponsorCosigner } from "../vault/cosign";
import { createSubmitterSession, type SubmitterSession } from "./submitter-session";

/**
 * A tap-trading session key (tap-trading.md §2, D-066): a fresh Ed25519 `CryptoKeyPair` from the browser's WebCrypto
 * whose private half is **non-extractable** (Kit's `generateKeyPair()` default). It is stored in IndexedDB as the
 * `CryptoKey` itself (structured clone keeps it non-extractable) and signs through `createSignerFromKeyPair`, so its
 * secret never exists as bytes in the page. `session-key-non-extractable` keeps it that way.
 */
export interface SessionKey {
  address: Address;
  /** WebCrypto's `CryptoKeyPair`, named through Kit so Node-only consumers without the DOM lib still typecheck. */
  keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
}

export async function generateSessionKey(): Promise<SessionKey> {
  const keyPair = await generateKeyPair();
  return { address: (await getAddressFromPublicKey(keyPair.publicKey)) as string as Address, keyPair };
}

export interface SessionKeySessionConfig {
  env: MarketsEnv;
  keyPair: SessionKey["keyPair"];
  journal: IntentJournal;
  nowMs?: () => number;
  /** The fee-payer co-signer for the key's taps; absent, the key pays from its own SOL (tap-trading.md §1.3 step 8). */
  sponsor?: SponsorCosigner;
  rpc?: WriteRpc;
}

/**
 * The key's own signing session (Masayume `sessions/session-key.ts`): its own journal and serialised sends, signed by
 * the non-extractable key under the owner's SESSION grant. Taps go through `route: { kind: "vault-grant", grantId }`;
 * dispose it whenever the grant, the key or the owner changes.
 */
export function createSessionKeySession(config: SessionKeySessionConfig): Promise<SubmitterSession> {
  return createSubmitterSession({
    env: config.env,
    authority: "session-key",
    signer: { keyPair: config.keyPair },
    journal: config.journal,
    ...(config.nowMs ? { nowMs: config.nowMs } : {}),
    ...(config.sponsor ? { sponsor: config.sponsor } : {}),
    ...(config.rpc ? { rpc: config.rpc } : {}),
  });
}
