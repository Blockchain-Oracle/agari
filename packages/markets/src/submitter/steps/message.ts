import { COMPUTE_MARGIN_BPS, COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";
import { chainFailure } from "../chain-failure";
import { SimulationFailedError } from "../errors";

export type WriteRpc = Rpc<SolanaRpcApi>;

const BPS = 10_000;

async function simulateMessage(rpc: WriteRpc, message: Parameters<typeof compileTransaction>[0]) {
  const wire = getBase64EncodedWireTransaction(compileTransaction(message));
  const { value } = await rpc.simulateTransaction(wire, { encoding: "base64", sigVerify: false, commitment: "confirmed" }).send();
  return { ...value, bytes: getBase64Encoder().encode(wire).length };
}

async function composeWrite(rpc: WriteRpc, feePayer: TransactionSigner, instructions: readonly Instruction[]) {
  const { value: latest } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  return { message, lastValidBlockHeight: latest.lastValidBlockHeight };
}

export type BuiltWrite = Awaited<ReturnType<typeof composeWrite>> & {
  /** Units the simulation consumed (compute-budget instruction included). */
  unitsConsumed: number;
  computeUnitLimit: number;
  /** The unsigned wire size, signature slots included. */
  bytes: number;
};

/**
 * A v0 message paid by `feePayer`, simulated (`sigVerify: false`) at the ceiling, then limited to the simulated units
 * plus 10%, never above 400,000 (D-012). A failed simulation throws `SimulationFailedError`: nothing is signed or sent.
 */
export async function buildWrite(rpc: WriteRpc, feePayer: TransactionSigner, instructions: readonly Instruction[]): Promise<BuiltWrite> {
  const composed = await composeWrite(rpc, feePayer, instructions);
  const sim = await simulateMessage(rpc, setTransactionMessageComputeUnitLimit(COMPUTE_UNIT_LIMIT_MAX, composed.message));
  if (sim.err) throw new SimulationFailedError(chainFailure(sim.err, sim.logs), "simulation");
  const unitsConsumed = Number(sim.unitsConsumed ?? BigInt(COMPUTE_UNIT_LIMIT_MAX));
  const computeUnitLimit = Math.min(COMPUTE_UNIT_LIMIT_MAX, Math.ceil((unitsConsumed * COMPUTE_MARGIN_BPS) / BPS));
  return {
    message: setTransactionMessageComputeUnitLimit(computeUnitLimit, composed.message),
    lastValidBlockHeight: composed.lastValidBlockHeight,
    unitsConsumed,
    computeUnitLimit,
    bytes: sim.bytes,
  };
}
