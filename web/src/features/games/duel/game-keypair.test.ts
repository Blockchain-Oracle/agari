import { verifySignedMessage } from "@agari/core/auth";
import { describe, expect, it } from "vitest";
import { webCryptoEd25519 } from "@/lib/auth/verify-signed-message.server";
import { encodeBase58 } from "@agari/core/types";
import { generateGameKeypair, parseStoredSecret, signWithGameKey } from "./game-keypair";

describe("the game key as a Solana keypair", () => {
  it("round-trips its stored 64-byte form and signs texts the server verifies", async () => {
    const pair = await generateGameKeypair();
    expect(pair.secretKey).toHaveLength(64);
    const restored = parseStoredSecret(encodeBase58(pair.secretKey));
    expect(restored?.address).toBe(pair.address);

    const text = "Agari — open the duel room\nNetwork: Solana devnet";
    const signature = await signWithGameKey(pair.secretKey, text);
    expect(await verifySignedMessage({ text, signature, signer: pair.address }, webCryptoEd25519)).toBe(true);
    expect(await verifySignedMessage({ text: `${text}.`, signature, signer: pair.address }, webCryptoEd25519)).toBe(false);
  });

  it("treats an EVM-era record as no key at all", () => {
    expect(parseStoredSecret(`0x${"11".repeat(32)}`)).toBeNull();
    expect(parseStoredSecret(undefined)).toBeNull();
  });
});
