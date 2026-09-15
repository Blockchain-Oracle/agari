/** Test-only: real v0 transactions built with Kit, partially signed by the tap key with the sponsor as a plain fee payer. */
import { ACTOR_PLACE_FOR_DISCRIMINATOR } from "@agari/clients/agari-vault";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import {
  AccountRole,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getTransactionEncoder,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type Instruction,
  type KeyPairSigner,
  type ReadonlyUint8Array,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
} from "@solana/kit";

export async function sponsorFixture() {
  const [sponsor, key, vaultKey, ownerKey, accountKey, hashKey] = await Promise.all(Array.from({ length: 6 }, () => generateKeyPairSigner()));
  const vault = vaultKey!.address;
  const owner = ownerKey!.address;
  const account = accountKey!.address;
  const blockhash = hashKey!.address as string as Blockhash;

  const vaultIx = (discriminator: ReadonlyUint8Array = ACTOR_PLACE_FOR_DISCRIMINATOR, extra: Instruction["accounts"] = []): Instruction => ({
    programAddress: vault,
    accounts: [{ address: key!.address, role: AccountRole.READONLY_SIGNER, signer: key! } as never, { address: owner, role: AccountRole.READONLY }, { address: account, role: AccountRole.WRITABLE }, ...(extra ?? [])],
    data: Uint8Array.from([...discriminator, 7, 0, 0, 0]),
  });
  const cu = (units: number) => getSetComputeUnitLimitInstruction({ units });

  const message = (instructions: Instruction[], feePayer: Address = sponsor!.address, version: 0 | "legacy" = 0) =>
    pipe(
      createTransactionMessage({ version: version as 0 }),
      (m) => setTransactionMessageFeePayer(feePayer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: 1_150n }, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );

  /** Signs every attached signer (the key) and leaves the plain fee payer's slot empty; returns the wire bytes. */
  const wire = async (m: TransactionMessage & TransactionMessageWithFeePayer) => new Uint8Array(getTransactionEncoder().encode(await partiallySignTransactionMessageWithSigners(m as never)));

  return { sponsor: sponsor as KeyPairSigner, key: key as KeyPairSigner, vault, owner, account, blockhash, vaultIx, cu, message, wire };
}
