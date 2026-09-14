import { describe, expect, it } from "vitest";
import { testAddress, testSignature } from "../testing/ids";
import { messageBytes, networkLine, verifySignedMessage, type Ed25519Verify } from "./signed-message";
import type { Signature } from "../types/primitives";

const SIGNER = testAddress(7);
const SIG = testSignature(9);

describe("verifySignedMessage", () => {
  it("hands the verifier the exact 64 signature bytes, UTF-8 text bytes and 32 key bytes", async () => {
    const seen: number[][] = [];
    const verify: Ed25519Verify = (signature, message, key) => {
      seen.push([signature.length, message.length, key.length, signature[0]!, key[0]!]);
      return true;
    };
    const text = `Agari — open the duel room\n${networkLine("devnet")}`;
    expect(await verifySignedMessage({ text, signature: SIG, signer: SIGNER }, verify)).toBe(true);
    // "—" is three UTF-8 bytes, so byte length ≠ string length: the signature covers bytes, not UTF-16 units.
    expect(seen).toEqual([[64, messageBytes(text).length, 32, 9, 7]]);
    expect(messageBytes(text).length).toBe(text.length + 2);
  });

  it("is a plain false for malformed base58, a wrong length or a throwing verifier, never an exception", async () => {
    const yes: Ed25519Verify = () => true;
    expect(await verifySignedMessage({ text: "x", signature: "0xab" as Signature, signer: SIGNER }, yes)).toBe(false);
    expect(await verifySignedMessage({ text: "x", signature: SIGNER as unknown as Signature, signer: SIGNER }, yes)).toBe(false);
    expect(await verifySignedMessage({ text: "x", signature: SIG, signer: SIG as unknown as typeof SIGNER }, yes)).toBe(false);
    expect(await verifySignedMessage({ text: "x", signature: SIG, signer: SIGNER }, () => { throw new Error("bad point"); })).toBe(false);
  });
});
