import { describe, expect, it } from "vitest";
import { decodeBase58, encodeBase58, isBase58OfLength } from "./base58";

const hex = (h: string): Uint8Array => Uint8Array.from((h.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

// Bitcoin Core's base58 vectors, plus the wrapped-SOL mint and the System Program as Solana anchors.
const VECTORS: readonly [string, string][] = [
  ["", ""],
  ["61", "2g"],
  ["626262", "a3gV"],
  ["636363", "aPEr"],
  ["73696d706c792061206c6f6e6720737472696e67", "2cFupjhnEsSn59qHXstmK2ffpLv2"],
  ["00eb15231dfceb60925886b67d065299925915aeb172c06647", "1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L"],
  ["0000287fb4cd", "11233QC4"],
  ["0000000000000000000000000000000000000000000000000000000000000000", "11111111111111111111111111111111"],
  ["069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f00000000001", "So11111111111111111111111111111111111111112"],
];

describe("base58", () => {
  it("matches the reference vectors both ways, leading zeros included", () => {
    for (const [bytes, text] of VECTORS) {
      expect(encodeBase58(hex(bytes))).toBe(text);
      expect(decodeBase58(text)).toEqual(hex(bytes));
    }
  });

  it("rejects characters outside the alphabet and checks exact byte length", () => {
    for (const bad of ["0", "O", "I", "l", "abc+", "So1111111111111111111111111111111111111111é"]) expect(decodeBase58(bad)).toBeNull();
    expect(isBase58OfLength("So11111111111111111111111111111111111111112", 32)).toBe(true);
    expect(isBase58OfLength("So11111111111111111111111111111111111111112", 64)).toBe(false);
    expect(isBase58OfLength("11111111111111111111111111111111", 32)).toBe(true);
    expect(isBase58OfLength("1111111111111111111111111111111", 32)).toBe(false);
  });
});
