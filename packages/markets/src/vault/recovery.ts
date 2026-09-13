import { SIDE_TO_OUTCOME, type Address, type Hex, type MarketId, type Side } from "@masayume/core/types";
import { parseEventLogs, type TransactionReceipt } from "viem";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { getClient, getVaultDeployment } from "../runtime/read-runtime";

export type RecoveredVaultExecution =
  | { status: "unknown" }
  | { status: "reverted"; txHash: Hex }
  | { status: "confirmed"; txHash: Hex; cashDelta: bigint; tokenDelta: bigint; atSec: number; side: Side };

export interface VaultExecutionEvidence {
  owner: Address;
  actor: Address;
  marketId: MarketId;
  grantId: bigint;
  side: Side;
  fromBlock: bigint;
  txHash: Hex | null;
  /** Captured before send. A missing hash cannot be matched safely from market/grant alone. */
  expectedNonce?: number | null;
}

const executions = (logs: TransactionReceipt["logs"]) => parseEventLogs({ abi: eventVaultAbi, eventName: "Executed", logs });
type ExecutedLog = ReturnType<typeof executions>[number];
const matches = (log: ExecutedLog, input: VaultExecutionEvidence, vault: Address) =>
  !log.removed && log.address.toLowerCase() === vault.toLowerCase()
  && log.args.owner.toLowerCase() === input.owner.toLowerCase() && log.args.actor.toLowerCase() === input.actor.toLowerCase()
  && log.args.marketId.toLowerCase() === input.marketId.toLowerCase() && log.args.grantId === input.grantId
  && log.args.outcomeIdx === SIDE_TO_OUTCOME[input.side] && log.args.isBuy;

/** A known hash must match the actor, vault and every instruction identity before its deltas are trusted. */
export function recoverVaultReceipt(input: VaultExecutionEvidence, receipt: TransactionReceipt, vault: Address): RecoveredVaultExecution {
  if (!input.txHash || receipt.transactionHash.toLowerCase() !== input.txHash.toLowerCase()
    || receipt.from.toLowerCase() !== input.actor.toLowerCase() || receipt.to?.toLowerCase() !== vault.toLowerCase()) return { status: "unknown" };
  if (receipt.status === "reverted") return { status: "reverted", txHash: input.txHash };
  const matching = executions(receipt.logs).filter(log => matches(log, input, vault));
  if (matching.length !== 1) return { status: "unknown" };
  const args = matching[0]!.args;
  return { status: "confirmed", txHash: input.txHash, cashDelta: args.cashDelta, tokenDelta: args.tokenDelta,
    atSec: Number(args.atSec), side: input.side };
}

/** Read-only recovery: absence, competing orders and missing nonce evidence never authorize a replay. */
export async function recoverVaultExecution(input: VaultExecutionEvidence): Promise<RecoveredVaultExecution> {
  const deployment = getVaultDeployment();
  if (!deployment) throw new Error("EventVault is not deployed");
  const vault = deployment.eventVault;
  const client = getClient().getViemClient();
  if (input.txHash) {
    const receipt = await client.getTransactionReceipt({ hash: input.txHash }).catch(() => null);
    return receipt ? recoverVaultReceipt(input, receipt, vault) : { status: "unknown" };
  }
  if (!Number.isSafeInteger(input.expectedNonce) || input.expectedNonce! < 0 || input.fromBlock < 0n) return { status: "unknown" };
  const head = await client.getBlockNumber();
  const event = eventVaultAbi.find((item) => item.type === "event" && item.name === "Executed")!;
  // Bound a recovery cycle. Never truncate evidence into an absence or success claim.
  const MAX_PAGES = 20;
  for (let start = input.fromBlock, page = 0; start <= head && page < MAX_PAGES; start += 50_000n, page++) {
    const end = start + 49_999n < head ? start + 49_999n : head;
    const logs = await client.getLogs({ address: vault, event,
      args: { owner: input.owner, marketId: input.marketId, grantId: input.grantId }, fromBlock: start, toBlock: end });
    for (const log of executions(logs).filter(candidate => matches(candidate, input, vault))) {
      const hash = log.transactionHash;
      if (!hash) continue;
      const transaction = await client.getTransaction({ hash });
      if (transaction.nonce !== input.expectedNonce || transaction.from.toLowerCase() !== input.actor.toLowerCase()
        || transaction.to?.toLowerCase() !== vault.toLowerCase()) continue;
      const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
      if (receipt) return recoverVaultReceipt({ ...input, txHash: hash }, receipt, vault);
    }
  }
  return { status: "unknown" };
}
