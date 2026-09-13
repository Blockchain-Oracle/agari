import type { IntentJournal, PhaseListener, TxOutcome, VaultIntent } from "@masayume/core/ports";
import { diagnosis, type Address, type Diagnosis, type Hex } from "@masayume/core/types";
import { GRANT_KIND_INDEX, VAULT_NOT_DEPLOYED, type VaultDeployment } from "@masayume/core/vault";
import { formatBaseUnits } from "@masayume/core/units";
import {
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  WaitForTransactionReceiptTimeoutError,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { isTimeoutError } from "../submitter/failure";
import { checkGas, gasLimitFor, type GasCheck } from "../submitter/gas";
import { TxRevertedError } from "../submitter/steps/assert-tx-ok";
import { diagnoseVault } from "./errors";
import type { SponsorTransport } from "./sponsor";

/** The session's own viem clients for Masayume's contracts — bound once, beside the SDK trader. */
export interface VaultContracts {
  walletClient: WalletClient;
  publicClient: PublicClient;
  deployment: VaultDeployment | null;
  /** A relayer that pays for allowlisted calls the signer signed; absent, the signer pays its own gas. */
  sponsor?: SponsorTransport;
}

export interface VaultTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

const RECEIPT_TIMEOUT_MS = 90_000;
const RECEIPT_POLL_MS = 700;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The receipt, by direct poll. viem's `waitForTransactionReceipt` watches for new blocks through
 * the SDK's client and missed an instantly-mined transaction on a fork for the full 90 s; asking
 * for the receipt itself cannot. A timeout still reads as one, so the lane journals it unknown.
 */
export async function awaitReceipt(publicClient: PublicClient, hash: Hex, label: string): Promise<TransactionReceipt> {
  const startedAt = Date.now();
  for (;;) {
    const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
    if (receipt) {
      if (receipt.status !== "success") throw new TxRevertedError(label, hash);
      return receipt;
    }
    if (Date.now() - startedAt > RECEIPT_TIMEOUT_MS) throw new WaitForTransactionReceiptTimeoutError({ hash });
    await sleep(RECEIPT_POLL_MS);
  }
}

type VaultFn = ContractFunctionName<typeof eventVaultAbi, "nonpayable">;
type Args<F extends VaultFn> = ContractFunctionArgs<typeof eventVaultAbi, "nonpayable", F>;

export interface Sent {
  hash: Hex;
  receipt: TransactionReceipt;
}

/** Persist the known hash before waiting for a receipt; this never submits another transaction. */
export type VaultBroadcastListener = (hash: Hex) => void | Promise<void>;

/** A local failure after broadcast is uncertain, not evidence that the call was refused. */
export class VaultBroadcastError extends Error {
  constructor(readonly txHash: Hex, cause: unknown) {
    super(`vault transaction ${txHash} was broadcast, but its outcome could not be recorded`, { cause });
    this.name = "VaultBroadcastError";
  }
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/** A sponsored function needs no STT from the signer; everything else must clear the lane's own gas envelope. */
export async function checkVaultGas(contracts: VaultContracts | undefined, wallet: Address, lane: "vault" | "vault-order", functionName: VaultFn): Promise<GasCheck> {
  if (contracts?.sponsor?.covers(functionName)) return { ok: true, lane, balanceWei: 0n, requiredWei: 0n };
  return checkGas(wallet, lane);
}

/**
 * Simulate first — that is where viem decodes the vault's custom errors — then send, then wait for
 * the receipt. With a sponsor bound, the signer signs an ERC-2771 request and the relayer sends; a
 * refusal falls back to the signer's own transaction, so a sponsor that is down never blocks a write.
 */
export async function writeVault<F extends VaultFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string, onBroadcast?: VaultBroadcastListener): Promise<Sent> {
  const deployment = contracts.deployment;
  if (!deployment) throw new Error(VAULT_NOT_DEPLOYED);
  const { request } = await contracts.publicClient.simulateContract({
    address: deployment.eventVault,
    abi: eventVaultAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const gas = gasLimitFor("vault");
  let hash: Hex | null = null;
  if (contracts.sponsor?.covers(functionName)) {
    const data = encodeFunctionData({ abi: eventVaultAbi, functionName, args } as never);
    hash = await contracts.sponsor.send({ functionName, to: deployment.eventVault, data, gas });
  }
  if (!hash) hash = await contracts.walletClient.writeContract({ ...(request as object), gas } as never);
  try {
    await onBroadcast?.(hash);
    return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
  } catch (error) {
    if (error instanceof TxRevertedError) throw error;
    throw new VaultBroadcastError(hash, error);
  }
}

/** The vault's first ERC-20 allowance is absorbed into the deposit that needs it (Approvals convention). */
export async function ensureVaultAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
  const deployment = contracts.deployment;
  if (!deployment) throw new Error(VAULT_NOT_DEPLOYED);
  const owner = account(contracts);
  const token = getCollateral().address;
  const allowance = await contracts.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, deployment.eventVault] });
  if (allowance >= amountBase) return null;
  const hash = await contracts.walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [deployment.eventVault, maxUint256],
    account: contracts.walletClient.account ?? owner,
    chain: SOMNIA_SHANNON,
    gas: gasLimitFor("approve"),
  });
  await awaitReceipt(contracts.publicClient, hash, "approve");
  return hash;
}

function capsTuple(terms: { caps: { maxStakePerTradeBase: bigint; maxDailySpendBase: bigint; maxOpenPositions: number; maxPriceRaw: bigint } }) {
  const { caps } = terms;
  return { maxStakePerTrade: caps.maxStakePerTradeBase, maxDailySpend: caps.maxDailySpendBase, maxOpenPositions: caps.maxOpenPositions, maxPriceRaw: caps.maxPriceRaw };
}

/** One intent, one contract call. Deposits absorb their allowance first. */
export async function sendVaultIntent(contracts: VaultContracts, intent: VaultIntent, onBroadcast?: VaultBroadcastListener): Promise<Sent> {
  switch (intent.kind) {
    case "vault-deposit":
      await ensureVaultAllowance(contracts, intent.amountBase);
      return writeVault(contracts, "deposit", [intent.amountBase], intent.kind, onBroadcast);
    case "vault-withdraw":
      return writeVault(contracts, "withdraw", [intent.amountBase], intent.kind, onBroadcast);
    case "vault-move-private":
      return writeVault(contracts, "moveToPrivate", [intent.amountBase], intent.kind, onBroadcast);
    case "vault-withdraw-private":
      return writeVault(contracts, "withdrawPrivate", [intent.amountBase], intent.kind, onBroadcast);
    case "vault-grant": {
      const t = intent.terms;
      return writeVault(contracts, "grant", [GRANT_KIND_INDEX[t.kind], t.actor, capsTuple(t), BigInt(t.expiresAtSec), t.budgetBase], intent.kind, onBroadcast);
    }
    case "vault-deposit-and-grant": {
      const t = intent.terms;
      await ensureVaultAllowance(contracts, intent.amountBase);
      return writeVault(contracts, "depositAndGrant", [intent.amountBase, GRANT_KIND_INDEX[t.kind], t.actor, capsTuple(t), BigInt(t.expiresAtSec), t.budgetBase], intent.kind, onBroadcast);
    }
    case "vault-fund-grant":
      return writeVault(contracts, "fundGrant", [intent.grantId, intent.amountBase], intent.kind, onBroadcast);
    case "vault-revoke":
      return writeVault(contracts, "revoke", [intent.grantId], intent.kind, onBroadcast);
    case "vault-crank-settle":
      return writeVault(contracts, "crankSettle", [intent.owner, intent.marketId], intent.kind, onBroadcast);
    case "vault-sweep":
      return writeVault(contracts, "sweep", [intent.pool], intent.kind, onBroadcast);
  }
}

function vaultFunctionOf(intent: VaultIntent): VaultFn {
  switch (intent.kind) {
    case "vault-deposit":
      return "deposit";
    case "vault-withdraw":
      return "withdraw";
    case "vault-move-private":
      return "moveToPrivate";
    case "vault-withdraw-private":
      return "withdrawPrivate";
    case "vault-grant":
      return "grant";
    case "vault-deposit-and-grant":
      return "depositAndGrant";
    case "vault-fund-grant":
      return "fundGrant";
    case "vault-revoke":
      return "revoke";
    case "vault-crank-settle":
      return "crankSettle";
    case "vault-sweep":
      return "sweep";
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizeVault(intent: VaultIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "vault-deposit":
      return `deposit ${amount(intent.amountBase)} into the Trading Balance`;
    case "vault-withdraw":
      return `withdraw ${amount(intent.amountBase)} from the Trading Balance`;
    case "vault-move-private":
      return `move ${amount(intent.amountBase)} to the private balance`;
    case "vault-withdraw-private":
      return `withdraw ${amount(intent.amountBase)} from the private balance`;
    case "vault-grant":
      return `grant ${intent.terms.kind} to ${intent.terms.actor} with ${amount(intent.terms.budgetBase)}`;
    case "vault-deposit-and-grant":
      return `deposit ${amount(intent.amountBase)} and grant ${intent.terms.kind} to ${intent.terms.actor}`;
    case "vault-fund-grant":
      return `add ${amount(intent.amountBase)} to grant #${intent.grantId}`;
    case "vault-revoke":
      return `revoke grant #${intent.grantId}`;
    case "vault-crank-settle":
      return `settle ${intent.marketId} into ${intent.owner}'s Trading Balance`;
    case "vault-sweep":
      return `sweep the vault's pool credit`;
  }
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

export async function settleVaultFailure(journal: IntentJournal, id: string, error: unknown, onPhase?: PhaseListener, diagnoseFn: (error: unknown) => Diagnosis = diagnoseVault, knownHash?: Hex): Promise<TxOutcome> {
  const cause = error instanceof VaultBroadcastError ? error.cause : error;
  const txHash = error instanceof VaultBroadcastError || error instanceof TxRevertedError ? error.txHash : knownHash;
  const diag = diagnoseFn(cause);
  if (error instanceof TxRevertedError) {
    const recorded = await settleBroadcastJournal(journal, id, error.txHash, diag.technical);
    onPhase?.("reverted", { txHash: error.txHash });
    return { status: "reverted", diagnosis: recorded ? diag : { ...diag, technical: `${diag.technical}. The intent journal could not be fully updated.` }, txHash: error.txHash };
  }
  if (txHash || isTimeoutError(cause)) {
    const recorded = await settleBroadcastJournal(journal, id, txHash);
    onPhase?.("unknown", txHash ? { txHash } : undefined);
    return {
      status: "unknown",
      diagnosis: diagnosis("send-unknown", recorded ? diag.technical : `${diag.technical}. The intent journal could not be fully updated.`, txHash ? { txHash } : {}),
      ...(txHash ? { txHash } : {}),
    };
  }
  await journal.markFailed(id, diag.technical);
  onPhase?.("composing");
  return refused(diag);
}

/** Storage failure cannot undo a broadcast or turn an uncertain send into permission to retry. */
async function settleBroadcastJournal(journal: IntentJournal, id: string, txHash?: Hex, failureReason?: string): Promise<boolean> {
  let recorded = true;
  if (txHash) {
    try {
      await journal.markSent(id, txHash);
    } catch {
      recorded = false;
    }
  }
  try {
    if (failureReason !== undefined) await journal.markFailed(id, failureReason);
    else await journal.markUnknown(id);
  } catch {
    recorded = false;
  }
  return recorded;
}

/** AD-3's second lane for the vault: journal → gas → (allowance) → simulate → send → receipt → book. */
export async function submitVaultTx(ctx: VaultTxContext, intent: VaultIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts?.deployment) return refused(diagnosis("not-deployed", VAULT_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeVault(intent, getCollateral().decimals) });
  const gas = await checkVaultGas(contracts, wallet, "vault", vaultFunctionOf(intent));
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  let broadcastHash: Hex | undefined;
  try {
    const { hash } = await sendVaultIntent(contracts, intent, async (hash) => {
      broadcastHash = hash;
      await ctx.journal.markSent(record.id, hash);
    });
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, undefined, broadcastHash);
  }
}
