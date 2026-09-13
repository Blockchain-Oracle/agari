import { z } from "zod";

export type Hex = `0x${string}`;
export type Address = Hex;
export type Bytes32 = Hex;

const HEX_RE = /^0x[0-9a-fA-F]*$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export const isHex = (v: unknown): v is Hex => typeof v === "string" && HEX_RE.test(v);
export const isAddress = (v: unknown): v is Address => typeof v === "string" && ADDRESS_RE.test(v);
export const isBytes32 = (v: unknown): v is Bytes32 => typeof v === "string" && BYTES32_RE.test(v);

export const hexSchema = z.custom<Hex>(isHex, "expected 0x-prefixed hex");
export const addressSchema = z.custom<Address>(isAddress, "expected a 20-byte address");
export const bytes32Schema = z.custom<Bytes32>(isBytes32, "expected a 32-byte hex value");
