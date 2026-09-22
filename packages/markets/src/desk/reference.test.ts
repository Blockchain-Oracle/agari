import { readFileSync } from "node:fs";
import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { DESK_REF_MESSAGE_BYTES, deskReferenceMessage } from "./reference";

const vector = JSON.parse(readFileSync(new URL("../../../../anchor/tests/vectors/desk/reference-message.json", import.meta.url), "utf8")) as {
  fields: { programId: string; clusterTag: number; mint: string; tokenPriceE8: string; markPriceE8: string; multiplierE12: string; fetchedAtSec: string };
  length: number;
  hex: string;
};

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("the 114-byte agari-desk-ref-v1 message", () => {
  it("matches the vector the program asserts (reference.rs)", () => {
    const f = vector.fields;
    const message = deskReferenceMessage({
      programId: address(f.programId),
      clusterTag: f.clusterTag,
      mint: address(f.mint),
      tokenPriceE8: BigInt(f.tokenPriceE8),
      markPriceE8: BigInt(f.markPriceE8),
      multiplierE12: BigInt(f.multiplierE12),
      fetchedAtSec: Number(f.fetchedAtSec),
    });
    expect(message).toHaveLength(DESK_REF_MESSAGE_BYTES);
    expect(vector.length).toBe(DESK_REF_MESSAGE_BYTES);
    expect(hex(message)).toBe(vector.hex);
    // The domain and the program id are the first 49 bytes, so a print signature can never be replayed as a reference.
    expect(new TextDecoder().decode(message.subarray(0, 17))).toBe("agari-desk-ref-v1");
  });

  it("binds every field: one byte of one integer changes the message", () => {
    const f = vector.fields;
    const base = { programId: address(f.programId), clusterTag: f.clusterTag, mint: address(f.mint), tokenPriceE8: BigInt(f.tokenPriceE8), markPriceE8: BigInt(f.markPriceE8), multiplierE12: BigInt(f.multiplierE12), fetchedAtSec: Number(f.fetchedAtSec) };
    const one = hex(deskReferenceMessage(base));
    expect(hex(deskReferenceMessage({ ...base, markPriceE8: base.markPriceE8 + 1n }))).not.toBe(one);
    expect(hex(deskReferenceMessage({ ...base, fetchedAtSec: base.fetchedAtSec + 1 }))).not.toBe(one);
    expect(hex(deskReferenceMessage({ ...base, clusterTag: 103 }))).not.toBe(one);
  });
});
