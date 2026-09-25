import { createKeyPairSignerFromPrivateKeyBytes, signBytes, verifySignature } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { newSessionKeySeed, SESSION_KEY_SEED_BYTES, sessionKeyFromSeed } from "./session-key";

describe("the phone's session key", () => {
  it("imports a seed to the same address Kit derives, non-extractable, and signs for it", async () => {
    const seed = new Uint8Array(SESSION_KEY_SEED_BYTES).map((_, i) => i + 1);
    const key = await sessionKeyFromSeed(seed);
    const reference = await createKeyPairSignerFromPrivateKeyBytes(seed);
    expect(key.address).toBe(reference.address);
    expect(key.keyPair.privateKey.extractable).toBe(false);
    const message = new TextEncoder().encode("tap");
    const signature = await signBytes(key.keyPair.privateKey, message);
    expect(await verifySignature(key.keyPair.publicKey, signature, message)).toBe(true);
  });

  it("reloads a fresh seed to the same key", async () => {
    const { seed, key } = await newSessionKeySeed();
    expect(seed).toHaveLength(SESSION_KEY_SEED_BYTES);
    expect((await sessionKeyFromSeed(seed)).address).toBe(key.address);
  });

  it("refuses a seed of the wrong length", async () => {
    await expect(sessionKeyFromSeed(new Uint8Array(31))).rejects.toThrow(/32-byte/);
  });
});
