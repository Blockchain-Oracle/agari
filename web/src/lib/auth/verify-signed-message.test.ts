import { messageBytes, networkLine } from "@agari/core/auth";
import { encodeBase58, toAddress, toSignature } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { verifyWalletMessage } from "./verify-signed-message.server";

async function signer() {
  const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  return {
    address: toAddress(encodeBase58(raw)),
    sign: async (text: string) => toSignature(encodeBase58(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, keys.privateKey, Uint8Array.from(messageBytes(text)))))),
  };
}

describe("verifyWalletMessage", () => {
  it("accepts a real ed25519 signature over the exact text, and refuses one flipped byte or another signer", async () => {
    const wallet = await signer();
    const text = `Agari X account link\nWallet: ${wallet.address}\n${networkLine("devnet")}`;
    const signature = await wallet.sign(text);
    expect(await verifyWalletMessage({ text, signature, signer: wallet.address })).toBe(true);

    const flipped = `${text.slice(0, -1)}${text.at(-1) === "t" ? "u" : "t"}`;
    expect(await verifyWalletMessage({ text: flipped, signature, signer: wallet.address })).toBe(false);

    const other = await signer();
    expect(await verifyWalletMessage({ text, signature, signer: other.address })).toBe(false);
  });
});
