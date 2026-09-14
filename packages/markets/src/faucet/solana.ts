/**
 * The faucet's chain side on Solana (first-call.md §4, D-034). `prepare` signs a transaction whose bytes, signature and
 * `lastValidBlockHeight` the service commits before anything is sent; `broadcast` only ever re-sends those bytes, and
 * `inspect` decides a prepared claim from its signature and the finalized block height. Server-only.
 */
import { fetchGlobalConfig, findConfigPda } from "@agari/clients/agari-events";
import { LAMPORTS_PER_SIGNATURE } from "@agari/core/constants";
import { FaucetError, SOL_FAUCET_POLICY, TUSDC_FAUCET_POLICY, type AnyFaucetClaim, type FaucetClaimStatus } from "@agari/core/faucet";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  fetchMaybeToken,
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getMintToCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  address as kitAddress,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signature as kitSignature,
  signTransactionMessageWithSigners,
  type Address,
  type Base64EncodedWireTransaction,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { keypairAddress } from "../sessions/keypair";
import { landedAsJournaled, type MintTarget } from "./landed";

export interface FaucetKeys {
  /** `sol-faucet`: the SOL source, the fee payer of both claim kinds and the ATA rent payer. */
  funder: Uint8Array;
  /** `faucet-mint-authority`: signs `mintToChecked` only. Null leaves tUSDC claims unavailable. */
  mintAuthority: Uint8Array | null;
}
export interface PreparedFaucetTransaction { lastValidBlockHeight: number; feeLamports: string; rawTransaction: string; txHash: string }
export interface FaucetMint { address: Address; decimals: number; authority: Address }

/** Public devnet is slow under load; a hung read must fail the request, never hold the reservation lock. */
const RPC_TIMEOUT_MS = 7_000;
const bounded = () => ({ abortSignal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
const unavailable = (code: string, message: string) => new FaucetError(code, message, 503);

export function createSolanaFaucetChain(keys: FaucetKeys, rpcUrl: string) {
  const rpc = createSolanaRpc(rpcUrl);
  const address = kitAddress(keypairAddress(keys.funder));
  const mintAuthority = keys.mintAuthority ? kitAddress(keypairAddress(keys.mintAuthority)) : null;
  const once = <T>(make: () => Promise<T>) => {
    let value: Promise<T> | null = null;
    return () => (value ??= make().catch((error: unknown) => { value = null; throw error; }));
  };
  const funderSigner = once(() => createKeyPairSignerFromBytes(keys.funder));
  const authoritySigner = once(async () => {
    if (!keys.mintAuthority) throw unavailable("mint-unconfigured", "Test tUSDC is unavailable on this deployment.");
    return createKeyPairSignerFromBytes(keys.mintAuthority);
  });

  /** The venue's collateral mint (GlobalConfig), checked once: the server key must be its mint authority. */
  const mint = once(async (): Promise<FaucetMint> => {
    if (!mintAuthority) throw unavailable("mint-unconfigured", "Test tUSDC is unavailable on this deployment.");
    const [config] = await findConfigPda();
    const venue = await fetchGlobalConfig(rpc, config, bounded());
    const account = await fetchMint(rpc, venue.data.collateralMint, bounded());
    const authority = account.data.mintAuthority;
    if (authority.__option !== "Some" || authority.value !== mintAuthority) throw unavailable("mint-authority", "Test tUSDC is unavailable: this server cannot mint it.");
    if (account.data.decimals !== venue.data.collateralDecimals) throw unavailable("mint-decimals", "Test tUSDC is unavailable: the mint does not match the venue.");
    return { address: venue.data.collateralMint, decimals: account.data.decimals, authority: mintAuthority };
  });

  async function mintTarget(wallet: string): Promise<MintTarget & { mintAddress: Address; ataAddress: Address }> {
    const facts = await mint();
    const [ata] = await findAssociatedTokenPda({ owner: kitAddress(wallet), mint: facts.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    return { mint: facts.address, ata, authority: facts.authority, mintAddress: facts.address, ataAddress: ata };
  }

  /** Blockhash → sign → simulate. Nothing is sent: the service journals the result first. */
  async function sign(payer: KeyPairSigner, instructions: Instruction[], maxFeeLamports: bigint): Promise<PreparedFaucetTransaction> {
    const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send(bounded());
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );
    const transaction = await signTransactionMessageWithSigners(message);
    // No priority fee on devnet: the fee is the base fee per signature.
    const feeLamports = BigInt(Object.keys(transaction.signatures).length) * LAMPORTS_PER_SIGNATURE;
    if (feeLamports > maxFeeLamports) throw unavailable("fees-high", "Network fees are above the faucet limit. Try again later.");
    const rawTransaction = getBase64EncodedWireTransaction(transaction);
    const { value: simulation } = await rpc.simulateTransaction(rawTransaction, { encoding: "base64", commitment: "confirmed" }).send(bounded());
    // A transaction that cannot succeed is refused before it is journaled, so it spends no quota.
    if (simulation.err) throw unavailable("simulation-failed", "The faucet could not prepare this transfer right now. Please try again later.");
    return { lastValidBlockHeight: Number(blockhash.lastValidBlockHeight), feeLamports: feeLamports.toString(), rawTransaction, txHash: getSignatureFromTransaction(transaction) };
  }

  return {
    address,
    mintAuthority,
    cluster: SOL_FAUCET_POLICY.cluster,
    async balance(wallet: string): Promise<bigint> {
      const { value } = await rpc.getBalance(kitAddress(wallet), { commitment: "confirmed" }).send(bounded());
      return value;
    },
    mint,
    /** The wallet's tUSDC in base units; null when it has no token account yet. */
    async tokenBalance(wallet: string): Promise<bigint | null> {
      const { ataAddress } = await mintTarget(wallet);
      const account = await fetchMaybeToken(rpc, ataAddress, { commitment: "confirmed", ...bounded() });
      return account.exists ? account.data.amount : null;
    },
    /** A system transfer of `amountLamports` from the funder. */
    async prepare(wallet: string, amountLamports: bigint): Promise<PreparedFaucetTransaction> {
      const payer = await funderSigner();
      return sign(payer, [getTransferSolInstruction({ source: payer, destination: kitAddress(wallet), amount: amountLamports })], SOL_FAUCET_POLICY.maxTransferFeeLamports);
    },
    /** `[createAssociatedTokenIdempotent, mintToChecked]`: the funder pays the fee and any rent, the authority mints. */
    async prepareMint(wallet: string, amountBase: bigint): Promise<PreparedFaucetTransaction> {
      const [payer, authority, target, facts] = await Promise.all([funderSigner(), authoritySigner(), mintTarget(wallet), mint()]);
      const createAta = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner: kitAddress(wallet), mint: target.mintAddress, ata: target.ataAddress });
      const mintTo = getMintToCheckedInstruction({ mint: target.mintAddress, token: target.ataAddress, mintAuthority: authority, amount: amountBase, decimals: facts.decimals });
      return sign(payer, [createAta, mintTo], TUSDC_FAUCET_POLICY.maxMintFeeLamports);
    },
    async inspect(claim: AnyFaucetClaim): Promise<FaucetClaimStatus> {
      // Height first: once the FINALIZED height is past the blockhash's last valid height, a signature with no status
      // can never land (never landed; the quota stays used). Reading the status first would leave a race.
      const height = await rpc.getBlockHeight({ commitment: "finalized" }).send(bounded());
      const txHash = kitSignature(claim.txHash);
      const { value: [status] } = await rpc.getSignatureStatuses([txHash], { searchTransactionHistory: true }).send(bounded());
      if (!status) return height > BigInt(claim.lastValidBlockHeight) ? "reverted" : "prepared";
      // A processed-only status may still be dropped with its fork; only a confirmed answer decides.
      if (status.confirmationStatus === "processed") return "prepared";
      if (status.err) return "reverted";
      const landed = await rpc.getTransaction(txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send(bounded());
      if (!landed) return "prepared";
      return landedAsJournaled(landed, claim, claim.asset === "tusdc" ? await mintTarget(claim.wallet) : null) ? "confirmed" : "conflict";
    },
    /** Re-sends the journaled bytes. The same bytes carry the same signature, so a duplicate can never pay twice. */
    async broadcast(claim: AnyFaucetClaim): Promise<void> {
      const wire = claim.rawTransaction as Base64EncodedWireTransaction;
      let journaled: string | null = null;
      try { journaled = getSignatureFromTransaction(getTransactionDecoder().decode(getBase64Encoder().encode(wire))); } catch { /* checked below */ }
      if (journaled !== claim.txHash) throw unavailable("journal-invalid", "The saved faucet transfer needs operator review.");
      // Simulated at prepare; preflight on a re-send would only report the first send as "already processed".
      const sent = await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send(bounded());
      if (sent !== claim.txHash) throw unavailable("hash-mismatch", "The faucet transfer needs operator review.");
    },
  };
}

export type SolanaFaucetChain = ReturnType<typeof createSolanaFaucetChain>;
