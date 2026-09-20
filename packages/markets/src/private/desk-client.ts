import { CLUSTER_ID, DEFAULT_CLUSTER } from "@agari/core/constants";
import type { Address, Hash32 } from "@agari/core/types";
import type { Instruction, KeyPairSigner } from "@solana/kit";
import { createDeployClient, keypairSigner, type DeployClient } from "../deploy/client";
import { send } from "../deploy/send";
import { readDesk } from "./reads";

/**
 * The desk's own signer, server-side only. One key, one writer: every send goes through one queue, and every open
 * and cash-out holds its slot's lock so two requests for one bet cannot interleave their reads. It keeps no record
 * of anything; what it needs to resume is on the chain.
 */
export interface DeskClient {
  readonly address: Address;
  /** The numeric cluster id product types still bind (D-012). */
  readonly chainId: number;
  readonly signer: KeyPairSigner;
  readonly client: DeployClient;
  /** The on-chain Desk account, or null while there is none on this cluster. */
  contract(): Promise<Address | null>;
  /** Signs, sends and confirms as the desk key. Throws with the chain's own words when the chain refuses. */
  send(step: string, instructions: Instruction[]): Promise<string>;
  withSlotLock<T>(slotId: Hash32, task: () => Promise<T>): Promise<T>;
}

export interface DeskClientConfig {
  /** The desk role's 64-byte Solana keypair (`PRIVATE_DESK_PRIVATE_KEY`, parsed with `parseSecretKey`). */
  secretKey: Uint8Array;
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
}

export async function createDeskClient({ secretKey, rpcUrl, rpcSubscriptionsUrl }: DeskClientConfig): Promise<DeskClient> {
  const signer = await keypairSigner(secretKey);
  const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: secretKey });
  const locks = new Map<string, Promise<unknown>>();
  let queue: Promise<unknown> = Promise.resolve();
  let contract: Address | null = null;

  return {
    address: signer.address as string as Address,
    chainId: CLUSTER_ID[DEFAULT_CLUSTER],
    signer,
    client,
    async contract() {
      contract ??= (await readDesk())?.address ?? null;
      return contract;
    },
    send(step, instructions) {
      const next = queue.then(
        () => send({ client, log: () => undefined }, step, instructions, step),
        () => send({ client, log: () => undefined }, step, instructions, step),
      );
      queue = next.then(() => undefined, () => undefined);
      return next;
    },
    withSlotLock<T>(slotId: Hash32, task: () => Promise<T>): Promise<T> {
      const previous = locks.get(slotId) ?? Promise.resolve();
      const next = previous.then(task, task);
      locks.set(slotId, next.then(() => undefined, () => undefined));
      return next;
    },
  };
}
