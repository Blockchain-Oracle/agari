/**
 * Bitcoin-alphabet base58, the encoding of Solana addresses and transaction signatures.
 *
 * Core stays free of platform and chain dependencies, so it carries this small codec instead of
 * importing `@solana/kit`. It is exact: `decodeBase58` returns null for any character outside the
 * alphabet, and leading `1`s map to leading zero bytes in both directions.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const DIGIT = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) DIGIT[ALPHABET.charCodeAt(i)] = i;

export function decodeBase58(text: string): Uint8Array | null {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros++;
  // Little-endian base-256 digits of the value, grown as needed.
  const bytes: number[] = [];
  for (let i = zeros; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const digit = code < 128 ? DIGIT[code]! : -1;
    if (digit < 0) return null;
    let carry = digit;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i]!;
  return out;
}

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Little-endian base-58 digits of the value.
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let text = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) text += ALPHABET[digits[i]!];
  return text;
}

/** True when `text` is base58 for exactly `byteLength` bytes. */
export function isBase58OfLength(text: unknown, byteLength: number): text is string {
  if (typeof text !== "string" || text.length === 0 || text.length > Math.ceil(byteLength * 1.38) + 1) return false;
  return decodeBase58(text)?.length === byteLength;
}
