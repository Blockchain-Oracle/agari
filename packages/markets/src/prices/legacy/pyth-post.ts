/**
 * Posts Pyth accumulator updates to the Pyth Solana receiver as fully verified `PriceUpdateV2` accounts (prints.md §4.1).
 * web3.js 1 lives only in this folder (plan §6, `kit-import-boundary`): callers pass and get strings and bytes.
 *
 * Flow per update: Wormhole encoded-VAA account (init, write, verify all guardian signatures) → receiver `post_update`
 * into a fresh keypair account per feed → close the encoded VAA. The price update accounts stay open, because
 * `public_record_print_pyth` reads them in a later transaction; `closePythUpdates` reclaims their rent afterwards.
 */
import { PythSolanaReceiver, type InstructionWithEphemeralSigners } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair, PublicKey, type Signer, type VersionedTransaction } from "@solana/web3.js";

export type PythPostConfig = {
  /** HTTP RPC endpoint. May carry a provider key: never log it. */
  rpcUrl: string;
  /** 64-byte Solana CLI keypair (seed + public key): fee payer, rent payer and encoded-VAA write authority. */
  payerSecret: Uint8Array;
  /** Priority fee in micro-lamports per compute unit (default 0: devnet and Surfpool need none). */
  computeUnitPriceMicroLamports?: number;
};

export type PostedPriceUpdate = {
  /** Lower-case hex without `0x`, as in `price-sources.json`. */
  feedIdHex: string;
  /** The `PriceUpdateV2` account (owner: the default receiver `rec5EK…`, D-021). */
  address: string;
};

export type PythPostResult = { priceUpdates: PostedPriceUpdate[]; signatures: string[] };

/** Re-sends an unconfirmed transaction this often, until its blockhash expires. */
const RESEND_MS = 2_000;

type ReceiverWallet = ConstructorParameters<typeof PythSolanaReceiver>[0]["wallet"];

function payerKeypair(secret: Uint8Array): Keypair {
  if (secret.length !== 64) throw new Error(`expected a 64-byte keypair, got ${secret.length} bytes`);
  return Keypair.fromSecretKey(secret);
}

/** The receiver SDK only needs a wallet for its Anchor provider; every transaction here is signed explicitly. */
function receiverFor(connection: Connection, payer: Keypair): PythSolanaReceiver {
  const wallet = {
    payer,
    publicKey: payer.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  } as unknown as ReceiverWallet;
  return new PythSolanaReceiver({ connection, wallet });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One web3.js Connection per RPC URL for the process (each opens its own websocket for confirmations). */
const connections = new Map<string, Connection>();
function connectionFor(rpcUrl: string): Connection {
  let connection = connections.get(rpcUrl);
  if (!connection) connections.set(rpcUrl, (connection = new Connection(rpcUrl, "confirmed")));
  return connection;
}

/** Signs with a fresh blockhash, sends, and re-sends until confirmed; throws on a failed or expired transaction. */
async function sendConfirmed(connection: Connection, payer: Keypair, tx: VersionedTransaction, signers: Signer[]): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.message.recentBlockhash = blockhash;
  tx.sign([payer, ...signers]);
  const raw = tx.serialize();
  const signature = await connection.sendRawTransaction(raw, { preflightCommitment: "confirmed", maxRetries: 0 });
  let done = false;
  const confirmed = connection
    .confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed")
    .finally(() => {
      done = true;
    });
  void (async () => {
    while (!done) {
      await sleep(RESEND_MS);
      if (!done) await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => undefined);
    }
  })();
  const { value } = await confirmed;
  if (value.err) throw new Error(`transaction ${signature} failed: ${JSON.stringify(value.err)}`);
  return signature;
}

async function sendBatched(
  receiver: PythSolanaReceiver,
  payer: Keypair,
  instructions: InstructionWithEphemeralSigners[],
  computeUnitPriceMicroLamports: number,
  tightComputeBudget: boolean,
): Promise<string[]> {
  const batches = await receiver.batchIntoVersionedTransactions(instructions, { computeUnitPriceMicroLamports, tightComputeBudget });
  const signatures: string[] = [];
  for (const { tx, signers } of batches) signatures.push(await sendConfirmed(receiver.connection, payer, tx, signers));
  return signatures;
}

/**
 * Posts every feed in each base64 accumulator update (Hermes `/v2/updates/price/{T}` `binary.data[]`) with Full
 * verification. Transactions go out in order and each is confirmed before the next, since `post_update` needs the
 * verified VAA account.
 */
export async function postPythUpdates(config: PythPostConfig & { updatesBase64: string[] }): Promise<PythPostResult> {
  if (config.updatesBase64.length === 0) return { priceUpdates: [], signatures: [] };
  const payer = payerKeypair(config.payerSecret);
  const receiver = receiverFor(connectionFor(config.rpcUrl), payer);
  const built = await receiver.buildPostPriceUpdateInstructions(config.updatesBase64);
  // closeInstructions mixes receiver `reclaim_rent` (price updates, kept open) and Wormhole encoded-VAA closes (sent now).
  const vaaCloses = built.closeInstructions.filter((ix) => !ix.instruction.programId.equals(receiver.receiver.programId));
  // The SDK's per-instruction budgets undershoot `post_update` for a 3-feed update now and then (the S3 soak saw
  // "Computational budget exceeded" on rec5EK…), so posts keep the generous default limit; at a 0 priority fee it costs nothing.
  const signatures = await sendBatched(receiver, payer, [...built.postInstructions, ...vaaCloses], config.computeUnitPriceMicroLamports ?? 0, false);
  const priceUpdates = Object.entries(built.priceFeedIdToPriceUpdateAccount).map(([feedId, account]) => ({
    feedIdHex: feedId.replace(/^0x/, "").toLowerCase(),
    address: account.toBase58(),
  }));
  return { priceUpdates, signatures };
}

/** Closes price update accounts this payer posted (receiver `reclaim_rent`), returning the rent to the payer. */
export async function closePythUpdates(config: PythPostConfig & { addresses: string[] }): Promise<string[]> {
  if (config.addresses.length === 0) return [];
  const payer = payerKeypair(config.payerSecret);
  const receiver = receiverFor(connectionFor(config.rpcUrl), payer);
  const closes = await Promise.all(config.addresses.map((a) => receiver.buildClosePriceUpdateInstruction(new PublicKey(a))));
  // `reclaim_rent` instructions carry no compute budget: a tight limit would be 0, so keep the default per instruction.
  return sendBatched(receiver, payer, closes, config.computeUnitPriceMicroLamports ?? 0, false);
}

/** The receiver program `postPythUpdates` writes to (the SDK default; `agari-events` checks this owner). */
export const PYTH_RECEIVER_PROGRAM_ID = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
