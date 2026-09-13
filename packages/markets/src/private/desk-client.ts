import type { Address, Hex } from "@masayume/core/types";
import { createPublicClient, createWalletClient, http, type ContractFunctionArgs, type ContractFunctionName, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_SHANNON } from "../chain";
import { privateDeskAbi } from "../contracts/private-desk.abi";
import { getPrivateDeployment } from "../runtime/read-runtime";
import { createNonceQueue, type Enqueue } from "../sessions/nonce-queue";
import { gasLimitFor } from "../submitter/gas";
import { awaitReceipt, type Sent } from "../vault/write";

type DeskFn = ContractFunctionName<typeof privateDeskAbi, "nonpayable">;
type Args<F extends DeskFn> = ContractFunctionArgs<typeof privateDeskAbi, "nonpayable", F>;

/**
 * The desk's own signer — server-side only. One key, one writer: every send goes through one nonce
 * queue, and every open holds its slot's lock so two requests for one bet cannot interleave their reads.
 * It keeps no record of anything; what it needs to resume is on the contract.
 */
export interface DeskClient {
  readonly address: Address;
  readonly chainId: number;
  readonly contract: Address | null;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  send<F extends DeskFn>(functionName: F, args: Args<F>, label: string): Promise<Sent>;
  withSlotLock<T>(slotId: Hex, task: () => Promise<T>): Promise<T>;
}

export interface DeskClientConfig {
  privateKey: Hex;
  rpcUrl: string;
}

export function createDeskClient({ privateKey, rpcUrl }: DeskClientConfig): DeskClient {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: SOMNIA_SHANNON, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain: SOMNIA_SHANNON, transport: http(rpcUrl) });
  const enqueue: Enqueue = createNonceQueue();
  const locks = new Map<string, Promise<unknown>>();

  return {
    address: account.address as Address,
    chainId: SOMNIA_SHANNON.id,
    get contract() {
      return getPrivateDeployment()?.privateDesk ?? null;
    },
    publicClient,
    walletClient,
    send: (functionName, args, label) =>
      enqueue(async () => {
        const address = getPrivateDeployment()?.privateDesk;
        if (!address) throw new Error("PrivateDesk is not deployed on this network yet");
        // Simulate first — that is where viem decodes the desk's custom errors — then send, then wait.
        const { request } = await publicClient.simulateContract({ address, abi: privateDeskAbi, functionName, args, account, chain: SOMNIA_SHANNON } as never);
        const hash = await walletClient.writeContract({ ...(request as object), gas: gasLimitFor("private") } as never);
        return { hash, receipt: await awaitReceipt(publicClient, hash, label) };
      }),
    withSlotLock<T>(slotId: Hex, task: () => Promise<T>): Promise<T> {
      const key = slotId.toLowerCase();
      const previous = locks.get(key) ?? Promise.resolve();
      const next = previous.then(task, task);
      locks.set(key, next.then(() => undefined, () => undefined));
      return next;
    },
  };
}
