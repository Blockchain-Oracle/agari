import type { Address } from "@agari/core/types";
import { createKeyPairSignerFromPrivateKeyBytes, signBytes } from "@solana/kit";
import type { MarketsEnv } from "../../env";
import type { WalletSession } from "../../react/wallet-session";

/** The practice wallet's seed length: an ed25519 private key. */
export const PRACTICE_SEED_BYTES = 32;

/**
 * The app's practice wallet (D-128): a devnet-only key for anyone without a wallet app, seeded from 32 bytes the app
 * keeps in the Keychain / Keystore. Kit imports the seed non-extractable, so after this the bytes exist only in the
 * app's secure store. It is the same seam web's wallets hand to markets, so every flow signs through it unchanged.
 */
export async function practiceWalletSession(seed: Uint8Array, env: Pick<MarketsEnv, "cluster">): Promise<WalletSession> {
  if (env.cluster !== "devnet") throw new Error("the practice wallet signs on devnet only");
  if (seed.length !== PRACTICE_SEED_BYTES) throw new Error(`expected a ${PRACTICE_SEED_BYTES}-byte seed`);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  return {
    address: signer.address as string as Address,
    signer,
    signMessage: async (message) => new Uint8Array(await signBytes(signer.keyPair.privateKey, message)),
  };
}
