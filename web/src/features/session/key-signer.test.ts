import { decodeBase58 } from "@agari/core/types";
import { generateSessionKey } from "@agari/markets/sessions";
import { describe, expect, it } from "vitest";
import { keySessionWallet } from "./key-signer";

describe("session key signer", () => {
  it("signs a transaction's message bytes with the non-extractable key, verifiable under the key's address", async () => {
    const key = await generateSessionKey();
    expect(key.keyPair.privateKey.extractable).toBe(false);
    const wallet = keySessionWallet(key);
    const messageBytes = new TextEncoder().encode("agari v0 message bytes");
    const signer = wallet.signer as unknown as { signTransactions(txs: { messageBytes: Uint8Array }[]): Promise<Record<string, Uint8Array>[]> };
    const [dictionary] = await signer.signTransactions([{ messageBytes }]);
    const signature = dictionary![key.address]!;
    expect(signature).toHaveLength(64);
    const publicKey = await crypto.subtle.importKey("raw", new Uint8Array(decodeBase58(key.address)!), "Ed25519", false, ["verify"]);
    expect(await crypto.subtle.verify("Ed25519", publicKey, new Uint8Array(signature), messageBytes)).toBe(true);
    expect(await crypto.subtle.verify("Ed25519", publicKey, new Uint8Array(signature), new TextEncoder().encode("tampered"))).toBe(false);
  });
});
