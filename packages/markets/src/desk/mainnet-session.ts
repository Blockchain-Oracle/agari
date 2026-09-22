/**
 * The owner's mainnet session (plan §5.3, §8 C3), for the browser: the connected wallet's signer re-wrapped for
 * `solana:mainnet` by the web (C5), an RPC that is the app's own `/api/rpc/mainnet`, and every owner call as one
 * confirmation. It never goes through the devnet read runtime: the desk is real money on another cluster.
 *
 * Each write: build a v0 message → simulate at the ceiling → limit the units → sign with the wallet (or let a
 * sending-only wallet broadcast) → send → confirm by polling `getSignatureStatuses`. Nothing is journaled here; a
 * desk write is idempotent enough to read back from the chain.
 */
import { COMPUTE_MARGIN_BPS, COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import type { DeskMode } from "@agari/core/desk";
import type { Signature } from "@agari/core/types";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { getCreateAssociatedTokenIdempotentInstructionAsync } from "@solana-program/token";
import { signWrite } from "../sessions/wallet-signer";
import { chainFailure } from "../submitter/chain-failure";
import { confirmStep, type Landing } from "../submitter/steps/confirm";
import type { WriteRpc } from "../submitter/steps/message";
import { sendStep } from "../submitter/steps/send";
import { tokenProgramOf, USDC_MAINNET } from "./deployment";
import { allowTokenIx, depositIx, disallowTokenIx, openDeskIx, pauseIx, revokeOperatorIx, setLimitsIx, setModeIx, setOperatorIx, unpauseIx, withdrawIx, WHOLE_BALANCE } from "./instructions";
import { DeskSendError } from "./operator-client";
import { readDeskState, type DeskState } from "./reads";

const BPS = 10_000;

export interface DeskMainnetSessionConfig {
  /** The connected wallet account's signer for `solana:mainnet` (`createSignerFromWalletAccount(account, "solana:mainnet")`). */
  signer: TransactionSigner;
  /** `/api/rpc/mainnet` (same origin) or an absolute mainnet URL. */
  rpcUrl: string;
  usdcMint?: Address;
}

export interface DeskWriteResult {
  signature: Signature;
  landing: Landing;
}

export interface DeskMainnetSession {
  readonly owner: Address;
  readonly rpc: WriteRpc;
  readState(nowSec: number): Promise<DeskState | null>;
  openDesk(input: { operator: Address; perActionCapE6: bigint; dailyCapE6: bigint; maxPremiumBps: number; mode: DeskMode }): Promise<DeskWriteResult>;
  /** Up to eight names in one transaction. */
  allowTokens(mints: readonly Address[]): Promise<DeskWriteResult>;
  disallowToken(mint: Address): Promise<DeskWriteResult>;
  /** From the owner's associated account of `mint` (USDC, or a held name: PreStocks' 1 % fee applies). */
  deposit(input: { mint: Address; ownerToken: Address; amount: bigint }): Promise<DeskWriteResult>;
  /** To the owner's associated account only; `amount` omitted withdraws the whole balance. */
  withdraw(input: { mint: Address; amount?: bigint }): Promise<DeskWriteResult>;
  setLimits(input: { perActionCapE6: bigint; dailyCapE6: bigint; maxPremiumBps: number; requirePythIndex: boolean }): Promise<DeskWriteResult>;
  setMode(mode: DeskMode): Promise<DeskWriteResult>;
  setOperator(operator: Address): Promise<DeskWriteResult>;
  revokeOperator(): Promise<DeskWriteResult>;
  pause(): Promise<DeskWriteResult>;
  unpause(): Promise<DeskWriteResult>;
}

async function write(rpc: WriteRpc, signer: TransactionSigner, instructions: readonly Instruction[]): Promise<DeskWriteResult> {
  const { value: latest } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const wire = getBase64EncodedWireTransaction(compileTransaction(setTransactionMessageComputeUnitLimit(COMPUTE_UNIT_LIMIT_MAX, message)));
  const { value: sim } = await rpc.simulateTransaction(wire, { encoding: "base64", sigVerify: false, commitment: "confirmed" }).send();
  if (sim.err) throw new DeskSendError("simulation", chainFailure(sim.err, sim.logs), null);
  const units = Number(sim.unitsConsumed ?? BigInt(COMPUTE_UNIT_LIMIT_MAX));
  const limited = setTransactionMessageComputeUnitLimit(Math.min(COMPUTE_UNIT_LIMIT_MAX, Math.ceil((units * COMPUTE_MARGIN_BPS) / BPS)), message);
  const signed = await signWrite(signer, limited);
  if (signed.mode === "sign") await sendStep(rpc, signed.wire);
  const landing = await confirmStep(rpc, {
    signature: signed.signature,
    ...(signed.mode === "sign" ? { wire: signed.wire } : {}),
    lastValidBlockHeight: signed.mode === "sign" ? (signed.lastValidBlockHeight ?? latest.lastValidBlockHeight) : latest.lastValidBlockHeight,
  });
  if (landing.kind === "landed-failed") throw new DeskSendError("landed", landing.failure, signed.signature);
  return { signature: signed.signature, landing };
}

export function createDeskMainnetSession(config: DeskMainnetSessionConfig): DeskMainnetSession {
  const rpc = createSolanaRpcFromTransport(createDefaultRpcTransport({ url: config.rpcUrl as Parameters<typeof createDefaultRpcTransport>[0]["url"] })) as WriteRpc;
  const { signer } = config;
  const usdcMint = config.usdcMint ?? USDC_MAINNET;
  const owner = signer.address;
  const send = (ixs: readonly Instruction[]) => write(rpc, signer, ixs);
  return {
    owner,
    rpc,
    readState: (nowSec) => readDeskState(rpc, owner, nowSec, usdcMint),
    openDesk: async (i) => send([await openDeskIx({ owner: signer, operator: i.operator, perActionCapE6: i.perActionCapE6, dailyCapE6: i.dailyCapE6, maxPremiumBps: i.maxPremiumBps, mode: i.mode, usdcMint })]),
    allowTokens: async (mints) => {
      if (mints.length === 0 || mints.length > 8) throw new Error(`a desk allows between one and eight names at a time, got ${mints.length}`);
      return send(await Promise.all(mints.map((mint) => allowTokenIx(signer, mint))));
    },
    disallowToken: async (mint) => send([await disallowTokenIx(signer, mint)]),
    deposit: async (i) => send([await depositIx(signer, i.mint, i.ownerToken, i.amount, usdcMint)]),
    // The program pays only the owner's associated account and never creates it (a name the owner never held has
    // none yet), so the same transaction creates it idempotently first, owner paying.
    withdraw: async (i) =>
      send([
        await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: signer, owner, mint: i.mint, tokenProgram: tokenProgramOf(i.mint, usdcMint) }),
        await withdrawIx(signer, i.mint, i.amount ?? WHOLE_BALANCE, usdcMint),
      ]),
    setLimits: async (i) => send([await setLimitsIx(signer, i.perActionCapE6, i.dailyCapE6, i.maxPremiumBps, i.requirePythIndex)]),
    setMode: async (mode) => send([await setModeIx(signer, mode)]),
    setOperator: async (operator) => send([await setOperatorIx(signer, operator)]),
    revokeOperator: async () => send([await revokeOperatorIx(signer)]),
    pause: async () => send([await pauseIx(signer, owner)]),
    unpause: async () => send([await unpauseIx(signer)]),
  };
}
