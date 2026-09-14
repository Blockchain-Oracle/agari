import { decodeBase58, encodeBase58 } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { generateSessionKey } from "./keygen";

const PKCS8_ED25519_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

describe("session key generation", () => {
  it("stores seed ‖ public key, and the seed really signs for the address", async () => {
    const key = await generateSessionKey(1);
    const secret = decodeBase58(key.secretKey)!;
    expect(secret).toHaveLength(64);
    expect(encodeBase58(secret.subarray(32))).toBe(key.address);

    // Re-import the stored seed and check a signature verifies under the stored address.
    const pkcs8 = new Uint8Array(48);
    pkcs8.set(PKCS8_ED25519_PREFIX, 0);
    pkcs8.set(secret.subarray(0, 32), 16);
    const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
    const publicKey = await crypto.subtle.importKey("raw", new Uint8Array(decodeBase58(key.address)!), { name: "Ed25519" }, false, ["verify"]);
    const message = new TextEncoder().encode("agari session key");
    const signature = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, message);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, publicKey, signature, message)).toBe(true);
  });

  it("never repeats a key", async () => {
    const [a, b] = await Promise.all([generateSessionKey(), generateSessionKey()]);
    expect(a.address).not.toBe(b.address);
  });
});
