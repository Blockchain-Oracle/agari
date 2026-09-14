import { z } from "zod";
import { isBase58OfLength } from "./base58";

declare const addressBrand: unique symbol;
declare const signatureBrand: unique symbol;

/**
 * A Solana account address: base58 of 32 bytes (a wallet key or a PDA).
 * Base58 is case-sensitive, so an Address is compared and stored exactly as written, never lowercased.
 */
export type Address = string & { readonly [addressBrand]: true };

/** A Solana transaction signature: base58 of 64 bytes. It is the transaction's id. */
export type Signature = string & { readonly [signatureBrand]: true };

/** Raw bytes as 0x-prefixed hex: keccak commitments, oracle feed ids, RedStone's 20-byte signer ids. */
export type Hex = `0x${string}`;

/** A 32-byte hash or feed id as 0x-prefixed hex (Pyth feed ids, keccak digests, Switchboard feed hashes). */
export type Hash32 = Hex;

const HEX_RE = /^0x[0-9a-fA-F]*$/;
const HASH32_RE = /^0x[0-9a-fA-F]{64}$/;

export const isAddress = (v: unknown): v is Address => isBase58OfLength(v, 32);
export const isSignature = (v: unknown): v is Signature => isBase58OfLength(v, 64);
export const isHex = (v: unknown): v is Hex => typeof v === "string" && HEX_RE.test(v);
export const isHash32 = (v: unknown): v is Hash32 => typeof v === "string" && HASH32_RE.test(v);

export function toAddress(value: string): Address {
  if (!isAddress(value)) throw new Error(`not a base58 address: ${value}`);
  return value;
}

export function toSignature(value: string): Signature {
  if (!isSignature(value)) throw new Error(`not a base58 transaction signature: ${value}`);
  return value;
}

export const addressSchema = z.custom<Address>(isAddress, "expected a base58 Solana address");
export const signatureSchema = z.custom<Signature>(isSignature, "expected a base58 transaction signature");
export const hexSchema = z.custom<Hex>(isHex, "expected 0x-prefixed hex");
export const hash32Schema = z.custom<Hash32>(isHash32, "expected a 32-byte hex value");
