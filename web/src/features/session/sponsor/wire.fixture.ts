import { decodeBase58 } from "@agari/core/types";
import { generateSessionKey } from "@agari/markets/sessions";

/** Test-only: the v0 wire format written out by hand, so the policy tests build real bytes without Kit. */
export interface FixtureInstruction {
  program: string;
  accounts: string[];
  data: Uint8Array;
}

function shortvec(n: number): number[] {
  const out: number[] = [];
  let rest = n;
  do {
    let byte = rest & 0x7f;
    rest >>= 7;
    if (rest > 0) byte |= 0x80;
    out.push(byte);
  } while (rest > 0);
  return out;
}

export interface FixtureMessage {
  /** Signers first (fee payer at 0), then writable and readonly non-signers, in the order given. */
  signers: string[];
  readonlyUnsigned?: string[];
  others?: string[];
  blockhash: string;
  instructions: FixtureInstruction[];
  lookups?: number;
}

export function encodeMessageV0(m: FixtureMessage): Uint8Array {
  const readonly = m.readonlyUnsigned ?? [];
  const keys = [...m.signers, ...(m.others ?? []), ...readonly];
  const index = (key: string) => {
    const i = keys.indexOf(key);
    if (i < 0) throw new Error(`fixture key ${key} not in the list`);
    return i;
  };
  const bytes: number[] = [0x80, m.signers.length, 0, readonly.length, ...shortvec(keys.length)];
  for (const key of keys) bytes.push(...decodeBase58(key)!);
  bytes.push(...decodeBase58(m.blockhash)!);
  bytes.push(...shortvec(m.instructions.length));
  for (const ix of m.instructions) {
    bytes.push(index(ix.program), ...shortvec(ix.accounts.length), ...ix.accounts.map(index), ...shortvec(ix.data.length), ...ix.data);
  }
  bytes.push(...shortvec(m.lookups ?? 0));
  for (let i = 0; i < (m.lookups ?? 0); i += 1) bytes.push(...new Uint8Array(32), 1, 0, 0);
  return Uint8Array.from(bytes);
}

export function encodeWire(signatures: Uint8Array[], message: Uint8Array): Uint8Array {
  return Uint8Array.from([...shortvec(signatures.length), ...signatures.flatMap((s) => [...s]), ...message]);
}

export async function fixtureKey() {
  const key = await generateSessionKey();
  return { address: key.address as string, sign: async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.sign("Ed25519", key.keyPair.privateKey, new Uint8Array(bytes))) };
}

export const u32Instruction = (kind: number, value: number) => {
  const data = new Uint8Array(5);
  data[0] = kind;
  new DataView(data.buffer).setUint32(1, value, true);
  return data;
};

export const u64Instruction = (kind: number, value: bigint) => {
  const data = new Uint8Array(9);
  data[0] = kind;
  new DataView(data.buffer).setBigUint64(1, value, true);
  return data;
};
